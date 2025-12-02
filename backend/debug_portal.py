# debug_portal.py
from __future__ import annotations

import sys
import textwrap
from typing import Optional, Dict, Any

import feedparser

from config.portals import PORTALS
from core.article_fetcher import fetch_article_soup

# --- IMPORT ONLY ACTIVE PARSERS THAT EXIST & ARE IN PORTALS ---

from scrapers.bd import (
    jagonews24,
    risingbd,
    prothomalo,
    kalerkantho,
)

from scrapers.international import (
    bbc,
)

PARSERS: Dict[str, Any] = {
    "jagonews24": jagonews24.parse,
    "risingbd": risingbd.parse,
    "prothomalo": prothomalo.parse,
    "kalerkantho": kalerkantho.parse,
    "bbc": bbc.parse,
}


def _pick_first_entry(rss_url: str) -> Optional[Dict[str, Any]]:
    """
    Fetch one RSS feed and return the first entry (if any), WITHOUT checking DB.
    """
    print(f"Fetching RSS: {rss_url}")
    feed = feedparser.parse(rss_url)

    if getattr(feed, "bozo", False):
        print(f"  [WARN] Malformed RSS (bozo): {feed.bozo_exception!r}")

    entries = getattr(feed, "entries", [])
    print(f"  Entries found: {len(entries)}")

    if not entries:
        return None

    return entries[0]


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python debug_portal.py <portal_id>")
        print("Example: python debug_portal.py bbc")
        sys.exit(1)

    portal_id = sys.argv[1]
    cfg = PORTALS.get(portal_id)

    print("\n==============================")
    print(f"DEBUGGING PORTAL: {portal_id}")
    print("==============================")

    if cfg is None:
        print(f"❌ Unknown portal id: {portal_id}")
        sys.exit(1)

    rss_list = cfg.get("rss") or []
    if not rss_list:
        print("❌ No RSS URLs configured for this portal.")
        sys.exit(1)

    # Try each RSS URL until we get at least 1 entry
    entry: Optional[Dict[str, Any]] = None
    used_rss: Optional[str] = None

    for rss_url in rss_list:
        e = _pick_first_entry(rss_url)
        if e is not None:
            entry = e
            used_rss = rss_url
            break

    if entry is None:
        print("❌ No entries returned from ANY RSS URL.")
        sys.exit(0)

    link = (entry.get("link") or "").strip()
    title = (entry.get("title") or "").strip()
    summary = (entry.get("summary") or "").strip()
    pub = (entry.get("published") or entry.get("updated") or "").strip()

    print(f"\nUsing RSS URL: {used_rss}")
    print(f"URL: {link}")

    print("\n---- RAW RSS FIELDS ----")
    print("TITLE    :", title or "(empty)")
    print("SUMMARY  :", (summary[:250] + "…") if len(summary) > 250 else summary or "(empty)")
    print("PUBLISHED:", pub or "(empty)")

    parser = PARSERS.get(portal_id)

    # If there is no parser, we are effectively RSS-only
    if parser is None or cfg.get("scrape_mode") == "rss_only":
        print("\n---- PARSING ----")
        print("This portal is RSS-only or has no HTML parser registered.")
        print("TOPIC GUESS: (disabled)")
        print("\nDone.")
        return

    # Otherwise: fetch HTML and run parser
    print("\n---- HTML FETCH & PARSE ----")
    try:
        soup = fetch_article_soup(portal_id, link)
    except Exception as exc:
        print(f"❌ HTML fetch error: {exc}")
        return

    if soup is None:
        print("❌ Soup is None (blocked / fetch failed).")
        return

    try:
        parsed = parser(soup) or {}
    except Exception as exc:
        print(f"❌ Parser crashed: {exc}")
        return

    p_title = (parsed.get("title") or "").strip()
    p_body = (parsed.get("body") or "").strip()

    print("PARSED TITLE:", p_title or "(empty)")
    print("\nPARSED BODY (first 600 chars):\n")
    print(textwrap.shorten(p_body, width=600, placeholder="…") or "(empty)")

    print("\nTOPIC GUESS: (disabled)")
    print("\nDone.")


if __name__ == "__main__":
    main()
