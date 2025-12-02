# config/portals.py
"""
Portal configuration for the entire scraping system.

Scrape modes:
    "rss_only"  → only RSS title/summary, no HTML fetch
    "simple"    → simple BaseScraper HTTP fetch
    "browser"   → always browser automation
    "hybrid"    → BaseScraper → browser fallback (smart)

This file is intentionally “dumb config”:
    - runner/core logic decides how to use these flags
    - if a portal has no parser wired, runner will automatically
      fall back to RSS-only even if `scrape_mode` is "simple" or "hybrid".
"""

from typing import Dict, List, Optional, Iterator, TypedDict


class PortalConfig(TypedDict, total=False):
    rss: List[str]
    enabled: bool
    scrape_mode: str          # "simple" | "hybrid" | "browser" | "rss_only"
    hard_domains: List[str]
    language: str             # e.g. "bangla", "english"
    country: str              # e.g. "bd", "international"
    notes: str                # free-form operational notes


PORTALS: Dict[str, PortalConfig] = {

    # ======================================================
    # 🌍 INTERNATIONAL — ENABLED
    # ======================================================
    "bbc": {
        "rss": [
            "https://feeds.bbci.co.uk/news/rss.xml",
            "https://feeds.bbci.co.uk/news/world/rss.xml",
            "https://feeds.bbci.co.uk/news/world/asia/rss.xml",
        ],
        "enabled": True,
        # BBC is generally bot-friendly. Simple HTTP works very well.
        "scrape_mode": "simple",
        # NOTE: hard_domains must be normalized (no 'www.')
        "hard_domains": ["bbc.co.uk", "bbc.com"],
        "language": "english",
        "country": "international",
        "notes": (
            "Stable RSS + simple HTML parser. No JS/browser needed for now. "
            "If BBC introduces aggressive WAF or JS rendering in the future, "
            "we can flip to 'hybrid' without changing core logic."
        ),
    },

    # ======================================================
    # 🇧🇩 BANGLA NEWS PORTALS — ENABLED (HYBRID MODE)
    # ======================================================

    "prothomalo": {
        "rss": [
            # Tested: Entries found > 0
            "https://www.prothomalo.com/feed",
        ],
        "enabled": True,
        # IMPORTANT:
        # Prothom Alo uses WAF/JS and often blocks pure HTTP clients.
        # Use hybrid so BaseScraper tries first, then BrowserScraper.
        "scrape_mode": "hybrid",
        # Normalized domains (no 'www.')
        "hard_domains": ["prothomalo.com", "en.prothomalo.com"],
        "language": "bangla",
        "country": "bd",
        "notes": (
            "Runs in 'hybrid' due to WAF / bot protection. BaseScraper may work "
            "sometimes, but BrowserScraper is the reliable fallback. "
            "If things break badly, temporary 'rss_only' is a safe fallback."
        ),
    },

    "kalerkantho": {
        "rss": [
            # Tested: Entries found ~170+
            "https://www.kalerkantho.com/rss.xml",
        ],
        "enabled": True,
        # This portal frequently returns 403 to pure HTTP clients.
        # Hybrid ensures we fall back to the browser automatically.
        "scrape_mode": "hybrid",
        "hard_domains": ["kalerkantho.com"],
        "language": "bangla",
        "country": "bd",
        "notes": (
            "Uses hybrid: BaseScraper → if blocked/suspicious → BrowserScraper. "
            "Historically returns 403 for simple HTTP. If the article layout "
            "changes, only the HTML parser module needs updates."
        ),
    },

    "risingbd": {
        "rss": [
            # Tested: Entries found: 100
            "https://www.risingbd.com/rss/rss.xml",
        ],
        "enabled": True,
        # RisingBD is also sensitive to bots; hybrid makes it robust.
        "scrape_mode": "hybrid",
        "hard_domains": ["risingbd.com"],
        "language": "bangla",
        "country": "bd",
        "notes": (
            "Hybrid mode for better resilience against WAF and JS rendering. "
            "If RisingBD becomes fully hostile to automation, we can run "
            "RSS-only as a fallback while parsers are updated."
        ),
    },

    "jagonews24": {
        "rss": [
            # Tested: Entries found: 50
            "https://www.jagonews24.com/rss/rss.xml",
        ],
        "enabled": True,
        # JagoNews uses a mix of JS and anti-bot; hybrid recommended.
        "scrape_mode": "hybrid",
        "hard_domains": ["jagonews24.com"],
        "language": "bangla",
        "country": "bd",
        "notes": (
            "Hybrid mode ensures reliability when pure HTTP is blocked or "
            "content is loaded via JS. If selectors change, only the parser "
            "module (scrapers.bd.jagonews24) needs updates."
        ),
    },
}


def get_portal(portal_id: str) -> Optional[PortalConfig]:
    """Return config for a single portal, or None if unknown."""
    return PORTALS.get(portal_id)


def iter_enabled_portals() -> Iterator[tuple[str, PortalConfig]]:
    """Yield (portal_id, config) pairs for all enabled portals."""
    for pid, cfg in PORTALS.items():
        if cfg.get("enabled", False):
            yield pid, cfg


def validate_portals() -> None:
    """
    Basic sanity checks for misconfigurations.

    Raises:
        ValueError if any portal has an invalid or inconsistent config.
    """
    allowed_modes = {"simple", "hybrid", "browser", "rss_only"}

    for pid, cfg in PORTALS.items():
        if "scrape_mode" not in cfg:
            raise ValueError(f"Portal '{pid}' missing scrape_mode")

        if cfg["scrape_mode"] not in allowed_modes:
            raise ValueError(
                f"Portal '{pid}' has invalid scrape_mode '{cfg['scrape_mode']}'"
            )

        if "rss" not in cfg or not isinstance(cfg["rss"], list):
            raise ValueError(f"Portal '{pid}' RSS must be a list")

        if "hard_domains" in cfg and not isinstance(cfg["hard_domains"], list):
            raise ValueError(f"Portal '{pid}' hard_domains must be a list")
