# core/runner.py
"""
Orchestrates the entire scraping pipeline:

    1) Initialize DB
    2) Collect RSS items
    3) Fetch HTML (simple/hybrid/browser)
    4) Parse article (title/body + optional metadata)
    5) Save into DB
    6) Run single cycle OR interval loop

Topic classification is an OPTIONAL, separate step (not part of scraping).

Parsers:
    - Parser modules are imported *safely* via importlib.
    - If a parser module or its `parse` function is missing, we:
        * log a warning
        * run that portal in "RSS-only" mode (no HTML parsing)

This ensures that a missing/buggy parser never breaks the whole runner.
"""

from __future__ import annotations

import logging
import time
import importlib
from datetime import datetime
from collections import defaultdict
from typing import Dict, Callable, Any, Optional
from urllib.parse import urlparse

from config.portals import PORTALS, validate_portals
from core.rss_collector import collect
from core.article_fetcher import fetch_article_soup
from core import db

# -------------------------------------------------------------------------
# Logging
# -------------------------------------------------------------------------

logger = logging.getLogger("runner")
logging.basicConfig(
    level=logging.INFO,
    format="[%(levelname)s] %(asctime)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)


# -------------------------------------------------------------------------
# Parser Registry (safe, dynamic import)
# -------------------------------------------------------------------------


def _safe_import_parser(portal_id: str, module_path: str) -> Optional[Callable]:
    """
    Safely import `<module_path>.parse` for a given portal.

    If the module or function does not exist, log and return None.
    This prevents ImportError from killing the whole process.
    """
    try:
        module = importlib.import_module(module_path)
    except ImportError as exc:
        logger.warning(
            "Parser module not found for %s (%s). "
            "Portal will run in RSS-only mode.",
            portal_id,
            exc,
        )
        return None
    except Exception as exc:
        logger.error(
            "Unexpected error importing parser module for %s (%s). "
            "Portal will run in RSS-only mode.",
            portal_id,
            exc,
        )
        return None

    parse_fn = getattr(module, "parse", None)
    if not callable(parse_fn):
        logger.warning(
            "Parser function 'parse' missing or not callable in %s (%s). "
            "Portal will run in RSS-only mode.",
            module_path,
            portal_id,
        )
        return None

    return parse_fn


def _load_parsers() -> Dict[str, Callable[[Any], Dict[str, Optional[str]]]]:
    """
    Build the PARSERS registry.

    Keys  : portal_id as used in PORTALS and rss_collector (e.g. 'jagonews24')
    Values: callable parse(soup) -> dict with keys:
            'title', 'body', 'author', 'pub_date', 'summary' (optional)

    If a parser cannot be imported, that portal simply won't have an
    entry here, and process_item() will fallback to RSS-only behavior.
    """
    parser_modules = {
        # BD portals
        "prothomalo": "scrapers.bd.prothomalo",
        "kalerkantho": "scrapers.bd.kalerkantho",
        "risingbd": "scrapers.bd.risingbd",
        "jagonews24": "scrapers.bd.jagonews24",

        # International
        "bbc": "scrapers.international.bbc",
    }

    parsers: Dict[str, Callable] = {}

    for portal_id, module_path in parser_modules.items():
        parse_fn = _safe_import_parser(portal_id, module_path)
        if parse_fn is not None:
            parsers[portal_id] = parse_fn
            logger.debug("Registered parser for %s (%s)", portal_id, module_path)

    return parsers


PARSERS: Dict[str, Callable[[Any], Dict[str, Optional[str]]]] = _load_parsers()


# -------------------------------------------------------------------------
# Helpers: title derivation
# -------------------------------------------------------------------------


def _title_from_url(url: str) -> Optional[str]:
    """
    Fallback: make a human-ish title from URL slug.
    e.g. https://.../poison-the-plate-4044126 -> 'Poison the plate'
    """
    try:
        path = urlparse(url).path or ""
        slug = path.rstrip("/").split("/")[-1]
        # drop extension if any
        if "." in slug:
            slug = slug.split(".", 1)[0]

        slug = slug.replace("-", " ").replace("_", " ").strip()
        if not slug:
            return None

        # Basic beautify
        slug = slug[0].upper() + slug[1:]
        return slug
    except Exception:
        return None


def _derive_title(item: Dict[str, Any]) -> Optional[str]:
    """
    Try multiple RSS fields, then fall back to URL slug.
    Priority:
        1) item['title']
        2) item['summary']
        3) item['description']
        4) slug from item['link']

    NOTE: This assumes rss_collector includes these fields where possible.
    """
    for key in ("title", "summary", "description"):
        val = item.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()

    link = item.get("link")
    if isinstance(link, str) and link:
        slug_title = _title_from_url(link)
        if slug_title:
            return slug_title

    return None


# -------------------------------------------------------------------------
# Save Helper
# -------------------------------------------------------------------------


def save_article_to_db(
    portal: str,
    link: str,
    title: Optional[str],
    body: Optional[str],
    rss_date: Optional[str],
    author: Optional[str] = None,
    article_pub_date: Optional[str] = None,
    summary: Optional[str] = None,
) -> bool:
    """
    Unified DB insert.

    rss_date         = date from RSS feed (collector)
    article_pub_date = date parsed from article HTML (if any)

    NOTE: topic is NOT handled here anymore. We always store None,
    and run classification later as a separate/offline step.
    """
    return db.insert_news(
        portal=portal,
        url=link,
        title=title,
        content=body,
        topic=None,  # or "unknown" if your DB column is NOT NULL
        pub_date=rss_date,
        author=author,
        article_pub_date=article_pub_date,
        summary=summary,
    )


# -------------------------------------------------------------------------
# Process Single Item
# -------------------------------------------------------------------------


def process_item(item: Dict[str, Any]) -> bool:
    """
    Process one RSS item:
        RSS → Fetch HTML → Parse → DB

    Behavior:
        - For modes simple/hybrid/browser + parser present:
              try HTML parsing
              if HTML/WAF/403/etc. fails → fallback to RSS-only fields
        - For mode rss_only or missing parser:
              always RSS-only

    Returns:
        True = saved
        False = skipped / failed
    """
    source = item["source"]
    link = item["link"]

    # Robust RSS-derived fields
    rss_title: Optional[str] = _derive_title(item)
    rss_date = item.get("rss_date")
    rss_summary: Optional[str] = None
    for key in ("summary", "description"):
        v = item.get(key)
        if isinstance(v, str) and v.strip():
            rss_summary = v.strip()
            break

    cfg = PORTALS.get(source, {})
    enabled = cfg.get("enabled", True)
    mode = cfg.get("scrape_mode", "simple")  # simple | hybrid | browser | rss_only

    if not enabled:
        logger.info("Skipping disabled portal: %s", source)
        return False

    parser_fn = PARSERS.get(source)

    logger.info("Process: %s | %s [mode=%s]", source, link, mode)

    title: Optional[str] = None
    body: Optional[str] = None
    author: Optional[str] = None
    article_pub_date: Optional[str] = None
    summary: Optional[str] = None

    # Whether we should even attempt HTML based on mode + parser availability
    should_fetch_html = (
        mode in ("simple", "hybrid", "browser") and parser_fn is not None
    )

    # --------------- RSS-ONLY / NO PARSER PATH -----------------
    if not should_fetch_html:
        if parser_fn is None and mode != "rss_only":
            logger.info(
                "No parser registered for %s → falling back to RSS-only mode.",
                source,
            )
        title = rss_title
        body = None
        summary = rss_summary

    else:
        # --------------- FETCH HTML -----------------
        try:
            soup = fetch_article_soup(source, link)
        except Exception as err:
            logger.warning("Fetch crash: %s (%s) → RSS-only fallback", link, err)
            soup = None

        if soup is not None:
            # --------------- PARSER -----------------
            try:
                parsed = parser_fn(soup) or {}
            except Exception as err:
                logger.warning("Parser crash for %s: %s → RSS-only fallback", source, err)
                parsed = {}

            # Parsed title has highest priority; fallback to RSS-derived title
            title = parsed.get("title") or rss_title
            body = parsed.get("body")

            # Optional metadata (if scraper provides them)
            author = parsed.get("author")
            article_pub_date = parsed.get("pub_date")
            summary = parsed.get("summary") or rss_summary

        else:
            # HTML blocked / WAF / 403 etc. → RSS-only fallback for this item
            logger.info(
                "No HTML for %s (%s) → using RSS-only fields.",
                source,
                link,
            )
            title = rss_title
            body = None
            summary = rss_summary

    # --------------- Block-page / WAF placeholder protection ---------------
    BLOCK_PLACEHOLDER_TITLES = {
        "Sorry, you have been blocked",
    }
    if title and title.strip() in BLOCK_PLACEHOLDER_TITLES:
        # HTML gave us a WAF page title; use RSS-derived data instead.
        logger.info(
            "Detected block placeholder title for %s → falling back to RSS title/summary.",
            link,
        )
        title = rss_title
        body = None
        summary = rss_summary

        # If even RSS title is a block placeholder, just skip.
        if not title or title.strip() in BLOCK_PLACEHOLDER_TITLES:
            logger.info("Skipping blocked placeholder article: %s", link)
            return False

    # Final safety: still no title? Try deriving again from URL alone.
    if not title:
        fallback = _title_from_url(link)
        if fallback:
            logger.debug("Derived title from URL for %s: %s", link, fallback)
            title = fallback

    # --------------- VALIDATION -----------------
    if not title and not body:
        logger.info("Skip empty (title/body missing): %s", link)
        return False

    # --------------- SAVE -----------------
    ok = save_article_to_db(
        portal=source,
        link=link,
        title=title,
        body=body,
        rss_date=rss_date,
        author=author,
        article_pub_date=article_pub_date,
        summary=summary,
    )

    if ok:
        logger.info("Saved: %s [%s]", title or "(no title)", source)
        return True

    return False


# -------------------------------------------------------------------------
# One Full Cycle
# -------------------------------------------------------------------------


def run_single_cycle() -> None:
    logger.info("=== Single cycle started ===")

    # Sanity check portal config (fail fast if misconfigured)
    try:
        validate_portals()
    except Exception as exc:
        logger.error("Portal configuration invalid: %s", exc)
        raise

    # Ensure DB exists
    db.init_db()

    items = collect()
    logger.info("RSS total collected: %d", len(items))

    total = len(items)
    saved = 0
    skipped = 0

    stats = defaultdict(lambda: {"total": 0, "saved": 0, "skipped": 0})

    for item in items:
        portal = item.get("source", "unknown")
        stats[portal]["total"] += 1

        ok = process_item(item)
        if ok:
            saved += 1
            stats[portal]["saved"] += 1
        else:
            skipped += 1
            stats[portal]["skipped"] += 1

    logger.info("SUMMARY: total=%d | saved=%d | skipped=%d", total, saved, skipped)

    logger.info("--- Per Portal Stats ---")
    for portal, s in stats.items():
        logger.info(
            "  %s → total=%d | saved=%d | skipped=%d",
            portal,
            s["total"],
            s["saved"],
            s["skipped"],
        )


# -------------------------------------------------------------------------
# Loop Mode
# -------------------------------------------------------------------------


def run_loop(interval_minutes: int) -> None:
    logger.info("Starting loop, interval=%d min", interval_minutes)

    while True:
        start = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        logger.info("=== New Cycle (%s) ===", start)

        run_single_cycle()

        logger.info("Sleeping %d minutes...", interval_minutes)
        time.sleep(interval_minutes * 60)


# -------------------------------------------------------------------------
# CLI Entry
# -------------------------------------------------------------------------


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="News Scraper Runner")
    parser.add_argument(
        "interval",
        nargs="?",
        type=int,
        help="Run in loop mode (minutes). Empty → single cycle.",
    )

    args = parser.parse_args()

    if args.interval:
        run_loop(args.interval)
    else:
        run_single_cycle()


if __name__ == "__main__":
    main()
