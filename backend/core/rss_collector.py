# core/rss_collector.py
"""
RSS Collector Module
--------------------

Responsibilities:
    - Fetch RSS from all enabled portals
    - Parse entries safely
    - Resolve publication date
    - Remove duplicates using state_manager
    - Log everything cleanly

Output schema (per item) used by core.runner.process_item():

    {
        "source": str,          # portal id, e.g. "jagonews24"
        "link": str,            # article URL
        "rss_date": str|None,   # ISO8601 or raw date string
        "title": str|None,      # RSS title (cleaned)
        "summary": str|None,    # RSS summary/description (cleaned)
        "description": str|None # same as summary (for compatibility)
    }

Note:
    core.runner._derive_title() looks for:
        item["title"], item["summary"], item["description"]
    so we MUST populate those here to avoid fallback to URL slug / numeric IDs.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Dict, List, Optional, Any

import requests
import feedparser

from config.portals import iter_enabled_portals
from utils.state_manager import seen, mark_seen

log = logging.getLogger("rss_collector")


# ---------------------------------------------------------------------------
# Helper: convert RSS date → ISO format
# ---------------------------------------------------------------------------

def _parse_rss_date(entry: Any) -> Optional[str]:
    """
    Convert RSS entry date into ISO 8601 string if possible.

    Tries these in order:
        - published_parsed
        - updated_parsed
        - published
        - updated

    If parsing fails, returns the raw string or None.
    """
    # Structured datetime tuples from feedparser
    for key in ("published_parsed", "updated_parsed"):
        dt_struct = getattr(entry, key, None) or entry.get(key)
        if dt_struct:
            try:
                dt = datetime(*dt_struct[:6])
                return dt.isoformat()
            except Exception:
                # If parsing fails, just continue to fallback options
                pass

    # Raw published/updated text as fallback
    for key in ("published", "updated"):
        raw = getattr(entry, key, None) or entry.get(key)
        if raw:
            return raw

    return None


# ---------------------------------------------------------------------------
# Helper: light cleanup for broken RSS/HTML entities
# ---------------------------------------------------------------------------

def _clean_rss_text(text: Optional[str]) -> Optional[str]:
    """
    Light cleanup for broken RSS/HTML entities that often break XML
    or look ugly in titles/summaries.

    This is intentionally conservative. Extend this mapping as you see
    specific patterns in your logs.
    """
    if not isinstance(text, str):
        return None

    replacements = {
        "&nbsp;": " ",
        "&ensp;": " ",
        "&emsp;": " ",
        "&mdash;": "-",
        "&ndash;": "-",
        "&lsquo;": "'",
        "&rsquo;": "'",
        "&ldquo;": '"',
        "&rdquo;": '"',
    }

    text = text.strip()
    for bad, good in replacements.items():
        text = text.replace(bad, good)

    return text or None


# ---------------------------------------------------------------------------
# Helper: feedparser wrapper with UA + safety
# ---------------------------------------------------------------------------

def _load_feed(url: str):
    """
    Wrapper around requests + feedparser.parse with:
        - Custom User-Agent
        - Manual HTTP fetch
        - Light cleanup of malformed entities
        - Bozo logging (but we still try to use entries)
    """
    headers = {
        "User-Agent": (
            "NewsScraper/1.0 (contact: your-email@example.com) "
            "Python-requests+feedparser"
        )
    }

    try:
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
    except Exception as exc:
        log.error("HTTP error for RSS %s (%s)", url, exc)
        return None

    # Decode robustly
    try:
        text = resp.content.decode(resp.encoding or "utf-8", errors="ignore")
    except Exception as exc:
        log.error("Decode error for RSS %s (%s)", url, exc)
        return None

    # Clean common bad entities that break XML
    text = _clean_rss_text(text) or ""

    try:
        feed = feedparser.parse(text)
    except Exception as exc:
        log.error("feedparser.parse failed for %s (%s)", url, exc)
        return None

    if getattr(feed, "bozo", 0):
        log.warning(
            "Malformed RSS (bozo) for %s: %s",
            url,
            getattr(feed, "bozo_exception", None),
        )

    return feed


# ---------------------------------------------------------------------------
# Helper: Map a feedparser entry → our internal item dict
# ---------------------------------------------------------------------------

def _entry_to_item(portal_id: str, entry: Any) -> Optional[Dict[str, Any]]:
    """
    Convert a feedparser entry into our internal item dict.

    Ensures we always try to populate:
        - title
        - summary
        - description

    Returns None if the entry is unusable (e.g. no link).
    """
    link = getattr(entry, "link", None) or entry.get("link")
    if not link:
        log.debug("Entry skipped (no link field).")
        return None

    # Normalize strings
    if isinstance(link, bytes):
        try:
            link = link.decode("utf-8", errors="ignore")
        except Exception:
            link = str(link)

    link = str(link).strip()
    if not link:
        log.debug("Entry skipped (empty link after strip).")
        return None

    # RSS title
    raw_title = getattr(entry, "title", None) or entry.get("title")
    title = _clean_rss_text(raw_title)

    # RSS summary / description (either is fine)
    raw_summary = (
        getattr(entry, "summary", None)
        or entry.get("summary")
        or getattr(entry, "description", None)
        or entry.get("description")
    )
    summary = _clean_rss_text(raw_summary)

    rss_date = _parse_rss_date(entry)

    item: Dict[str, Any] = {
        "source": portal_id,
        "link": link,
        "rss_date": rss_date,
        # These 3 keys are used by core.runner._derive_title()
        "title": title,
        "summary": summary,
        "description": summary,  # keep same for compatibility
    }

    # Optional debug if a feed is not giving titles
    if title is None:
        log.debug("RSS entry without title: %s", link)

    return item


# ---------------------------------------------------------------------------
# Main function: fetch + dedupe RSS entries across all portals
# ---------------------------------------------------------------------------

def collect() -> List[Dict[str, Any]]:
    """
    Collect article links and basic metadata from **all enabled portals**.

    Returns:
        List of dicts:
            - source: portal id (e.g. "jagonews24")
            - link: article URL
            - rss_date: ISO8601 or raw published/updated string (if available)
            - title: RSS title (cleaned) or None
            - summary: RSS summary/description (cleaned) or None
            - description: same as summary (for compatibility)
    """
    results: List[Dict[str, Any]] = []

    log.info("========== RSS COLLECT START ==========")

    for portal_id, meta in iter_enabled_portals():
        rss_urls = meta.get("rss") or []

        if not rss_urls:
            log.info("Skipping %s (no RSS configured)", portal_id)
            continue

        log.info("")
        log.info(">>> Portal: %s | RSS feeds: %d", portal_id, len(rss_urls))

        for rss_url in rss_urls:
            log.info("Fetching RSS: %s", rss_url)

            feed = _load_feed(rss_url)
            if feed is None:
                # Error already logged in _load_feed
                continue

            entries = getattr(feed, "entries", [])
            log.info("Entries found: %d", len(entries))

            if len(entries) == 0:
                log.warning("RSS feed returned 0 entries: %s", rss_url)

            for entry in entries:
                try:
                    item = _entry_to_item(portal_id, entry)
                    if item is None:
                        continue

                    link = item["link"]

                    # Dedupe via state_manager (seen.json)
                    if seen(link):
                        log.debug("SKIPPED (already seen): %s", link)
                        continue

                    mark_seen(link)
                    results.append(item)

                except Exception as exc:
                    # Defensive: never let a single bad entry kill the whole cycle
                    log.error(
                        "Error processing RSS entry for portal %s: %s",
                        portal_id,
                        exc,
                    )
                    continue

    log.info("")
    log.info("RSS SUMMARY: NEW items collected = %d", len(results))
    log.info("========== RSS COLLECT END ==========")

    return results
