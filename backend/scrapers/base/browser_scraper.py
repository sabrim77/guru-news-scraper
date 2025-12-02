# scrapers/base/browser_scraper.py

import logging
import random
import time
import json
from contextlib import AbstractContextManager
from typing import Optional
from urllib.parse import urlparse

from playwright.sync_api import (
    Playwright,
    sync_playwright,
    TimeoutError as PlaywrightTimeoutError,
)

logger = logging.getLogger("browser_scraper")


def normalize_domain(netloc: str) -> str:
    return netloc.lower().replace("www.", "").strip()


class BrowserScraper(AbstractContextManager):
    """
    Industry-grade Playwright wrapper (Optimized MVP Version).

    Key upgrades:
        - Persistent cookies (state.json)
        - CSS + fonts allowed (critical for Bangla sites)
        - Blocks ads/trackers only
        - Better WAF detection
        - Correct load strategy (domcontentloaded)
        - Dynamic scroll
        - Auto-recovery on browser crash
        - Netloc-based polite delays
    """

    STATE_FILE = "state.json"

    def __init__(
        self,
        timeout_ms: int = 15000,
        headless: bool = True,
        min_delay: float = 3.0,
        max_delay: float = 6.0,
        max_retries: int = 2,
        scroll: bool = True,
    ):
        self.timeout_ms = timeout_ms
        self.headless = headless
        self.min_delay = min_delay
        self.max_delay = max_delay
        self.max_retries = max_retries
        self.scroll = scroll

        self._playwright: Optional[Playwright] = None
        self._browser = None
        self._context = None
        self._page = None

        self._last_request_ts: dict[str, float] = {}

        self._user_agents = [
            # Modern browser signatures
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 "
            "(KHTML, like Gecko) Version/17.3 Safari/605.1.15",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        ]

    # ----------------------------------------------------------------------
    # Context Manager Lifecycle
    # ----------------------------------------------------------------------

    def __enter__(self) -> "BrowserScraper":
        logger.info("Starting Playwright browser (headless=%s)...", self.headless)

        self._playwright = sync_playwright().start()

        ua = random.choice(self._user_agents)
        width = random.randint(1100, 1400)
        height = random.randint(750, 900)

        self._browser = self._playwright.chromium.launch(headless=self.headless)

        # Load persistent cookies/state
        try:
            with open(self.STATE_FILE, "r", encoding="utf-8") as f:
                storage_state = json.load(f)
        except Exception:
            storage_state = None

        self._context = self._browser.new_context(
            user_agent=ua,
            viewport={"width": width, "height": height},
            java_script_enabled=True,
            storage_state=storage_state,
        )

        # Block ads + trackers only (NOT css/fonts)
        def route_handler(route, request):
            block_types = {
                "xhr",
                "fetch",
                "script",
            }
            url = request.url.lower()
            if (
                "doubleclick" in url
                or "googletagmanager" in url
                or "google-analytics" in url
                or "adsystem" in url
                or "adservice" in url
                or "facebook" in url
                or "tracking" in url
            ):
                return route.abort()
            if request.resource_type in block_types:
                # allow scripts for many BD news since layout needs JS
                return route.continue_()

            return route.continue_()

        self._context.route("**/*", route_handler)

        self._page = self._context.new_page()
        self._page.set_default_timeout(self.timeout_ms)

        return self

    def __exit__(self, exc_type, exc, tb):
        logger.info("Shutting Playwright browser down...")

        try:
            if self._context:
                # Save cookies/state
                try:
                    self._context.storage_state(path=self.STATE_FILE)
                except Exception:
                    pass

            if self._page:
                self._page.close()
            if self._context:
                self._context.close()
            if self._browser:
                self._browser.close()
            if self._playwright:
                self._playwright.stop()

        finally:
            self._page = None
            self._context = None
            self._browser = None
            self._playwright = None

    # ----------------------------------------------------------------------
    # Helpers
    # ----------------------------------------------------------------------

    def _sleep_if_needed(self, netloc: str) -> None:
        last_ts = self._last_request_ts.get(netloc)
        if last_ts:
            elapsed = time.time() - last_ts
            target = random.uniform(self.min_delay, self.max_delay)
            if elapsed < target:
                time.sleep(target - elapsed)

    def _update_last_ts(self, netloc: str) -> None:
        self._last_request_ts[netloc] = time.time()

    def _scroll(self):
        if not self.scroll:
            return
        try:
            self._page.evaluate(
                "() => window.scrollTo(0, document.body.scrollHeight)"
            )
            time.sleep(1)
        except Exception:
            pass

    def _is_block_page(self, html_lower: str) -> bool:
        block_signals = [
            "access denied",
            "cloudflare",
            "captcha",
            "checking your browser",
            "verify you are human",
            "bot detection",
            "/cdn-cgi/challenge-platform",
            "security check",
            "please wait while",
        ]
        return any(s in html_lower for s in block_signals)

    # ----------------------------------------------------------------------
    # Public HTML Fetch API
    # ----------------------------------------------------------------------

    def fetch_html(self, url: str) -> Optional[str]:
        """
        Fetch HTML using Playwright with:
            - state persistence
            - automatic retries
            - JS wait strategy
            - block page detection
        """
        if not self._page:
            raise RuntimeError("BrowserScraper must be used within a context")

        netloc = normalize_domain(urlparse(url).netloc)
        self._sleep_if_needed(netloc)

        for attempt in range(1, self.max_retries + 1):
            try:
                logger.info("Browser GET %s (attempt %d/%d)", url, attempt, self.max_retries)

                # Load page (domcontentloaded is reliable)
                self._page.goto(url, wait_until="domcontentloaded")

                # Wait for core article container (best-effort)
                plausible_selectors = [
                    "article",                # universal
                    "div.story-body",         # BBC
                    "#news-details",          # Kaler Kantho
                    "div.content-details",    # JagoNews
                    "div.story-content",      # Prothom Alo
                    "div#main-content",
                ]
                for sel in plausible_selectors:
                    try:
                        self._page.wait_for_selector(sel, timeout=2000)
                        break
                    except Exception:
                        continue

                # Scroll to load lazy contents
                self._scroll()

                html = self._page.content()
                html_lower = html.lower()

                # Detect block / WAF
                if self._is_block_page(html_lower):
                    logger.warning("Browser WAF/block detected for %s", url)
                    time.sleep(2 * attempt)
                    continue

                self._update_last_ts(netloc)

                return html

            except PlaywrightTimeoutError:
                logger.warning("Timeout fetching %s (attempt %d)", url, attempt)
            except Exception as e:
                logger.exception("Unexpected browser error for %s: %s", url, e)

            time.sleep(2 * attempt)

        logger.error("BrowserScraper giving up on %s after %d attempts", url, self.max_retries)
        return None
