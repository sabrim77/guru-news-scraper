# scrapers/international/bbc.py

from typing import Optional, Dict
from bs4 import BeautifulSoup


def parse(soup: Optional[BeautifulSoup]) -> Dict[str, Optional[str]]:
    """
    Parse a BBC news article page into structured fields.

    Returns:
        {
          "title":   str|None,
          "body":    str|None,
          "author":  str|None,
          "pub_date":str|None,   # usually ISO string from meta tags
          "summary": str|None,   # short summary from body
        }
    """
    # Safety: no soup → fully empty structure
    if soup is None:
        return {
            "title": None,
            "body": None,
            "author": None,
            "pub_date": None,
            "summary": None,
        }

    # 1) Remove junk blocks
    for tag in soup.select(
        "script, style, noscript, iframe, aside, "
        "header nav, footer, .share, .social, .promo, .tags"
    ):
        tag.decompose()

    # 2) Title (BBC usually uses <h1>)
    title_tag = soup.find("h1")
    title = title_tag.get_text(strip=True) if title_tag else None

    # 3) Author
    author: Optional[str] = None

    # 3a) Meta-based byline
    meta_author = soup.find("meta", attrs={"name": "byl"})
    if meta_author and meta_author.get("content"):
        author = meta_author["content"].strip()

    # 3b) Visible byline blocks
    if not author:
        byline = (
            soup.select_one("[data-component='byline']")
            or soup.select_one(".ssrcss-1b8l8bp-Contributor")
            or soup.select_one(".ssrcss-1hf3ou5-Contributor")  # alt class
        )
        if byline:
            text = byline.get_text(" ", strip=True)
            if text:
                author = text

    # 4) Publication date (prefer meta tags)
    pub_date: Optional[str] = None

    meta_date = (
        soup.find("meta", attrs={"property": "article:published_time"})
        or soup.find("meta", attrs={"itemprop": "datePublished"})
        or soup.find("meta", attrs={"name": "OriginalPublicationDate"})
    )
    if meta_date and meta_date.get("content"):
        pub_date = meta_date["content"].strip()

    # 5) Article container
    article_container = (
        soup.find("article")
        or soup.find("main")
        or soup.select_one("div.ssrcss-1072xwf-ArticleWrapper")
        or soup
    )

    # 6) Paragraph collection
    paragraphs = article_container.find_all("p")
    if not paragraphs:
        # BBC sometimes uses data-component="text-block" spans/divs
        paragraphs = article_container.select("[data-component='text-block']")

    MIN_WORDS = 5
    MAX_WORDS = 200

    cleaned_parts = []
    for p in paragraphs:
        text = p.get_text(" ", strip=True)
        if not text:
            continue

        words = text.split()
        if not (MIN_WORDS <= len(words) <= MAX_WORDS):
            continue

        lower = text.lower()
        # Filter out common junk
        if (
            ("bbc" in lower and len(words) < 8)  # "BBC News", "BBC Sport", etc.
            or lower.startswith("image caption")
            or lower.startswith("video caption")
        ):
            continue

        cleaned_parts.append(text)

    # 7) Body text (keep paragraphs separated)
    body_text = "\n\n".join(cleaned_parts).strip() or None

    # 8) Summary – simple heuristic from first 2–3 paragraphs
    summary: Optional[str] = None
    if cleaned_parts:
        # Join first 2 or 3 blocks as a short abstract
        first_chunks = cleaned_parts[:2]
        summary_candidate = " ".join(first_chunks).strip()
        if summary_candidate:
            summary = summary_candidate

    return {
        "title": title,
        "body": body_text,
        "author": author,
        "pub_date": pub_date,
        "summary": summary,
    }
