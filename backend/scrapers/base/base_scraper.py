# scrapers/base/base_scraper.py

import logging
import random
import time
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger("base_scraper")


def normalize_domain(netloc: str) -> str:
    """Normalize domains so 'www.xyz.com' == 'xyz.com'."""
    return netloc.lower().replace("www.", "").strip()


class BaseScraper:
    """
    Industry-ready HTTP client (MVP level).

    Features:
        - Session reuse
        - Rotating UA + Accept-Language tuning
        - Smarter block-page detection
        - Returns Response ALWAYS (never None)
        - Sets '_suspected_block' flag instead of dropping resp
        - Domain-based polite delays
        - Retry + exponential backoff
        - Useful logs for debugging
        - Proxy support (optional)
    """

    def __init__(
        self,
        timeout: int = 10,
        min_delay: float = 1.5,
        max_delay: float = 4.0,
        max_retries: int = 3,
        proxies: dict | None = None,
    ):
        self.session = requests.Session()
        self.timeout = timeout
        self.min_delay = min_delay
        self.max_delay = max_delay
        self.max_retries = max_retries
        self.proxies = proxies

        # Per-domain timestamp
        self._last_request_ts: dict[str, float] = {}

        self._user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 "
            "(KHTML, like Gecko) Version/17.3 Safari/605.1.15",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
        ]

    # -------------------------------------------------------
    # Helpers
    # -------------------------------------------------------

    def _random_ua(self) -> str:
        return random.choice(self._user_agents)

    def _sleep_if_needed(self, netloc: str) -> None:
        """Polite per-domain wait."""
        last_ts = self._last_request_ts.get(netloc)
        if last_ts is None:
            return

        elapsed = time.time() - last_ts
        target = random.uniform(self.min_delay, self.max_delay)
        if elapsed < target:
            delay = target - elapsed
            logger.debug("Sleeping %.2fs before next request to %s", delay, netloc)
            time.sleep(delay)

    def _update_last_ts(self, netloc: str) -> None:
        self._last_request_ts[netloc] = time.time()

    # -------------------------------------------------------
    # Block detection heuristic
    # -------------------------------------------------------

    def _is_block_page(self, txt_lower: str) -> bool:
        signals = [
            "cloudflare",
            "attention required",
            "verify you are human",
            "checking your browser",
            "just a moment",
            "are you a robot",
            "access denied",
            "/cdn-cgi/",
            "bot detection",
            "captcha",
        ]
        return any(x in txt_lower for x in signals)

    # -------------------------------------------------------
    # GET request
    # -------------------------------------------------------

    def get(self, url: str) -> requests.Response:
        """
        NEVER returns None. Always returns Response (possibly flagged).
        HybridScraper depends on this, so we always return resp with:
            resp._suspected_block = True if block detected
        """

        netloc_raw = urlparse(url).netloc
        netloc = normalize_domain(netloc_raw)

        self._sleep_if_needed(netloc)

        last_resp: requests.Response | None = None

        for attempt in range(1, self.max_retries + 1):
            headers = {
                "User-Agent": self._random_ua(),
                "Accept": (
                    "text/html,application/xhtml+xml,application/xml;q=0.9,"
                    "image/avif,image/webp,*/*;q=0.8"
                ),
                "Accept-Language": "bn-BD,bn;q=0.9,en-US;q=0.8,en;q=0.7",
                "Referer": "https://www.google.com/",
            }

            try:
                logger.info("GET %s (attempt %d/%d)", url, attempt, self.max_retries)
                resp = self.session.get(
                    url,
                    headers=headers,
                    timeout=(10, self.timeout),
                    proxies=self.proxies,
                )
                last_resp = resp
                self._update_last_ts(netloc)

                status = resp.status_code
                logger.debug("Status %d from %s", status, url)

                # Normal status flow
                if status == 200:
                    txt_lower = resp.text.lower()

                    # Detect WAF/block
                    if self._is_block_page(txt_lower):
                        logger.warning("Suspected block page for %s", url)
                        resp._suspected_block = True  # mark for hybrid
                        return resp

                    resp._suspected_block = False
                    return resp

                # Retry-based statuses
                if status in (403, 429):
                    retry_after = int(resp.headers.get("Retry-After", 0) or 0)

                    if retry_after > 0:
                        logger.warning(
                            "Status %d with Retry-After=%s for %s",
                            status, retry_after, url
                        )
                        time.sleep(retry_after)
                    else:
                        delay = 4 * attempt
                        logger.warning(
                            "Status %d for %s, backing off %ds",
                            status, url, delay
                        )
                        time.sleep(delay)

                    continue

                # Other errors: retry with small delay
                logger.warning("Status %d from %s, retrying...", status, url)
                time.sleep(2 * attempt)
                last_resp._suspected_block = True

            except requests.RequestException as exc:
                logger.warning(
                    "Request error for %s (attempt %d/%d): %s [%s]",
                    url, attempt, self.max_retries, exc, type(exc).__name__,
                )
                time.sleep(2 * attempt)

        # Out of retries
        logger.error("Giving up on %s after %d attempts", url, self.max_retries)

        if last_resp is not None:
            last_resp._suspected_block = True
            return last_resp

        # fabricate a dummy Response object
        dummy = requests.Response()
        dummy.status_code = 599
        dummy._content = b""
        dummy._suspected_block = True
        dummy.url = url
        return dummy

    # -------------------------------------------------------
    # HTML fetch
    # -------------------------------------------------------

    def fetch_html(self, url: str) -> BeautifulSoup | None:
        resp = self.get(url)
        if not isinstance(resp, requests.Response):
            return None

        return BeautifulSoup(resp.text or "", "html.parser")
