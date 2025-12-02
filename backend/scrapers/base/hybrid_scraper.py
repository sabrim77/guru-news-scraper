# scrapers/base/hybrid_scraper.py

from __future__ import annotations

import logging
from typing import Optional, Iterable
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from .base_scraper import BaseScraper, normalize_domain
from .browser_scraper import BrowserScraper

logger = logging.getLogger("hybrid_scraper")


class HybridScraper:
    """
    Industry-Ready Hybrid Scraper.

    Order of operations:
        1. Try BaseScraper (HTTP)
        2. If blocked / suspicious / hard-domain → browser fallback
        3. Return BeautifulSoup always when possible

    Improvements:
        - Correct domain normalization
        - Reads BaseScraper block flag
        - Improved block detection logic
        - Safe browser fallback
        - Prevent false positives on short HTML
        - Unified soup creation
    """

    def __init__(
        self,
        base_scraper: BaseScraper,
        browser_scraper: Optional[BrowserScraper] = None,
        hard_domains: Optional[Iterable[str]] = None,
    ) -> None:
        self.base = base_scraper
        self.browser = browser_scraper

        # Normalize hard domains
        if hard_domains:
            self.hard_domains = {normalize_domain(d) for d in hard_domains}
        else:
            self.hard_domains = set()

    # ---------------------------------------------------------
    # Internal helpers
    # ---------------------------------------------------------

    @staticmethod
    def _get_netloc(url: str) -> str:
        return normalize_domain(urlparse(url).netloc)

    def _probably_blocked_html(self, html: str) -> bool:
        """Heuristic block detection based on HTML content."""
        if not html or len(html) < 300:  # lower threshold to avoid false positives
            return True

        lower = html.lower()
        signals = [
            "access denied",
            "cloudflare",
            "verify you are human",
            "checking your browser",
            "bot detection",
            "just a moment",
            "/cdn-cgi/",
            "captcha",
        ]
        return any(s in lower for s in signals)

    # ---------------------------------------------------------
    # Public HTML Fetch Logic
    # ---------------------------------------------------------

    def fetch_html(self, url: str, mode: str = "auto") -> Optional[BeautifulSoup]:
        """
        Fetch HTML and return BeautifulSoup.

        mode:
            - "simple"  → BaseScraper only
            - "browser" → browser only
            - "auto"    → BaseScraper → fallback to browser
        """

        netloc = self._get_netloc(url)

        if mode not in ("simple", "browser", "auto"):
            raise ValueError(f"Unknown mode '{mode}'")

        # If forced browser-only
        if mode == "browser":
            return self._fetch_with_browser(url)

        # Hard domain always prefers browser in auto mode
        if mode == "auto" and netloc in self.hard_domains:
            logger.info("Hard-domain match (%s) → Browser first for %s", netloc, url)
            return self._fetch_with_browser(url)

        # SIMPLE PATH
        soup, base_blocked = self._fetch_with_base(url)

        if mode == "simple":
            return soup  # even if blocked, simple-mode caller accepts it

        # AUTO MODE: fallback if blocked or soup empty
        if base_blocked or soup is None:
            logger.info("Falling back to browser for %s (base_blocked=%s)", url, base_blocked)
            return self._fetch_with_browser(url)

        return soup

    # ---------------------------------------------------------
    # BaseScraper path
    # ---------------------------------------------------------

    def _fetch_with_base(self, url: str) -> tuple[Optional[BeautifulSoup], bool]:
        """
        Returns: (soup, blocked_flag)
        """
        try:
            resp = self.base.get(url)
        except Exception as exc:
            logger.warning("BaseScraper crash for %s: %s", url, exc)
            return None, True

        # Block flag from BaseScraper
        if getattr(resp, "_suspected_block", False):
            logger.warning("BaseScraper flagged BLOCK for %s", url)
            return None, True

        status = resp.status_code
        if status != 200:
            logger.warning("BaseScraper non-200 (%s) for %s", status, url)
            return None, True

        html = resp.text or ""
        if self._probably_blocked_html(html):
            logger.warning("HTML looks blocked/suspicious for %s", url)
            return None, True

        return BeautifulSoup(html, "html.parser"), False

    # ---------------------------------------------------------
    # Browser path
    # ---------------------------------------------------------

    def _fetch_with_browser(self, url: str) -> Optional[BeautifulSoup]:
        if not self.browser:
            logger.error("BrowserScraper not available for %s", url)
            return None

        try:
            html = self.browser.fetch_html(url)
        except Exception as exc:
            logger.warning("BrowserScraper crash for %s: %s", url, exc)
            return None

        if not html:
            logger.warning("BrowserScraper empty HTML for %s", url)
            return None

        return BeautifulSoup(html, "html.parser")
