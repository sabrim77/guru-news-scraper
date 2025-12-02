# backend/api/main.py

from typing import Optional, List, Dict
from datetime import datetime

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl

from core import db
from core.fetch import fetch_news_from_user_query
from core.bd_sentiment import (
    analyze_bangladesh_sentiment,
    SentimentNotAvailable,
)


# ============================================================
# Pydantic models (response schemas)
# ============================================================

class NewsItem(BaseModel):
    """
    DB-backed article row (from core.db).
    Used for latest feed, topic feed, etc.
    """
    id: int
    portal: str
    url: HttpUrl
    title: Optional[str] = None
    summary: Optional[str] = None
    content: Optional[str] = None
    topic: Optional[str] = None
    pub_date: Optional[str] = None          # RSS date (stored as string in DB)
    article_pub_date: Optional[str] = None  # parsed HTML date (string)
    author: Optional[str] = None


class PaginatedNews(BaseModel):
    count: int
    limit: int
    offset: int
    items: List[NewsItem]


class SingleNewsResponse(BaseModel):
    found: bool
    item: Optional[NewsItem] = None


class FetchedArticle(BaseModel):
    """
    One article returned by keyword-based RSS fetch (core.fetch).

    Matches the dicts produced in fetch_news_for_keyword():
        {
            "title": str,
            "url": str,
            "summary": str,
            "content": None,
            "source": portal_id,
            "keyword": keyword,
            "published_at": datetime | None,
        }
    """
    title: str
    url: HttpUrl
    summary: Optional[str] = None
    content: Optional[str] = None
    source: str
    keyword: str
    published_at: Optional[datetime] = None


class KeywordFetchResponse(BaseModel):
    raw_query: str
    lang: Optional[str]
    country: Optional[str]
    keywords: List[str]
    total_fetched: int
    by_keyword: Dict[str, List[FetchedArticle]]


# ---------------- Sentiment models ----------------

class SentimentResult(BaseModel):
    label: str                      # positive | negative | neutral
    score: float                    # confidence
    towards_bangladesh: str         # positive | negative | neutral | unknown
    raw_label: str                  # original HF label (e.g. 1 star, 5 stars)


class AnalyzeTextRequest(BaseModel):
    text: str


class NewsSentimentResponse(BaseModel):
    url: HttpUrl
    title: Optional[str] = None
    portal: Optional[str] = None
    sentiment: SentimentResult


# ============================================================
# FastAPI app + CORS
# ============================================================

app = FastAPI(
    title="News Aggregation API",
    version="1.0.0",
    description="Multi-portal Bangladeshi & International news backend",
)

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    # Ensure DB exists / migrations done
    db.init_db()


# ============================================================
# Helpers: row -> NewsItem
# ============================================================

def _row_to_news_item(row) -> NewsItem:
    """
    Map DB row (dict or sqlite.Row) to NewsItem.

    Works with:
        - dict (row["col"] and row.get("col"))
        - sqlite3.Row (row["col"], supports .keys(), but no .get())
    """

    def _get(col: str):
        # If it's a normal dict-like:
        if isinstance(row, dict):
            return row.get(col)

        # sqlite3.Row or similar
        try:
            if hasattr(row, "keys"):
                keys = row.keys()
                if col in keys:
                    return row[col]
        except Exception:
            # Fallback: best-effort index access
            try:
                return row[col]
            except Exception:
                return None

        return None

    return NewsItem(
        id=row["id"],
        portal=row["portal"],
        url=row["url"],
        title=_get("title"),
        summary=_get("summary"),
        content=_get("content"),
        topic=_get("topic"),
        pub_date=_get("pub_date"),
        article_pub_date=_get("article_pub_date"),
        author=_get("author"),
    )


# ============================================================
# Health
# ============================================================

@app.get("/api/v1/health")
def health():
    return {"status": "ok"}


# ============================================================
# LATEST FEED (DB, no keyword / no topic)
# ============================================================

@app.get("/api/v1/news/latest", response_model=PaginatedNews)
def latest_news(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    portal: Optional[str] = Query(
        None,
        description="Optional portal filter, e.g. 'prothomalo', 'bbc'",
    ),
):
    """
    Get latest news items from DB, optionally filtered by portal.

    This is purely a DB read, using whatever the scraper has already
    ingested (core.runner or keyword fetch).
    """
    # core.db.get_latest should support: (limit, offset, portal=None)
    rows = db.get_latest(limit=limit, offset=offset, portal=portal)
    items = [_row_to_news_item(r) for r in rows]

    return PaginatedNews(
        count=len(items),
        limit=limit,
        offset=offset,
        items=items,
    )


# ============================================================
# TOPIC FEED (DB, structured filter)
# ============================================================

@app.get("/api/v1/news/by_topic", response_model=PaginatedNews)
def news_by_topic(
    topic: str = Query(
        ...,
        description="Classifier topic label, e.g. politics, sports, health, tech",
    ),
    portal: Optional[str] = Query(
        None,
        description="Optional portal filter",
    ),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """
    Topic-based DB feed:
        - Filter by classifier topic label (stored in DB.news.topic)
        - Optional portal filter
        - NO keyword / full-text FTS here
    """
    rows = db.get_latest_by_topic(
        topic=topic,
        portal=portal,
        limit=limit,
        offset=offset,
    )
    items = [_row_to_news_item(r) for r in rows]

    return PaginatedNews(
        count=len(items),
        limit=limit,
        offset=offset,
        items=items,
    )


# ============================================================
# KEYWORD SEARCH (RSS FETCH using core.fetch)
# ============================================================

@app.get("/api/v1/news/search", response_model=KeywordFetchResponse)
def keyword_search(
    q: str = Query(
        ...,
        description=(
            "Keyword(s) or phrase(s) to fetch from RSS. "
            "Examples: 'bitcoin', 'bitcoin, tesla', 'দেশে ফেরার সিদ্ধান্ত'"
        ),
    ),
    lang: Optional[str] = Query(
        None,
        description="Optional language filter: en, bn, english, bangla",
    ),
    country: Optional[str] = Query(
        None,
        description="Optional country filter: bd, bangladesh, intl, international",
    ),
):
    """
    Keyword-based fetch:
        - Uses core.fetch.fetch_news_from_user_query.
        - Iterates over enabled portals' RSS feeds.
        - Filters entries by keyword in title/summary.
        - Inserts matched articles into SQLite via db.insert_articles().
        - Returns freshly fetched articles grouped by keyword.

    This is NOT FTS on the DB; it is a live data fetch using the user's keywords.
    """
    lang_param = lang or None
    country_param = country or None

    result = fetch_news_from_user_query(
        user_input=q,
        lang=lang_param,
        country=country_param,
    )

    # result structure from core.fetch.fetch_news_for_query():
    # {
    #   "keywords": [...],
    #   "total_fetched": int,
    #   "by_keyword": {
    #       kw: [ {title, url, summary, content, source, keyword, published_at}, ... ]
    #   }
    # }

    keywords = result.get("keywords", [])
    total_fetched = result.get("total_fetched", 0)
    raw_by_kw = result.get("by_keyword", {})

    by_keyword_typed: Dict[str, List[FetchedArticle]] = {}

    for kw, articles in raw_by_kw.items():
        typed_list: List[FetchedArticle] = []
        for art in articles:
            typed_list.append(
                FetchedArticle(
                    title=art.get("title", ""),
                    url=art.get("url", ""),
                    summary=art.get("summary"),
                    content=art.get("content"),
                    source=art.get("source", ""),
                    keyword=art.get("keyword", kw),
                    published_at=art.get("published_at"),
                )
            )
        by_keyword_typed[kw] = typed_list

    return KeywordFetchResponse(
        raw_query=q,
        lang=lang_param,
        country=country_param,
        keywords=keywords,
        total_fetched=total_fetched,
        by_keyword=by_keyword_typed,
    )


# ============================================================
# FETCH BY URL (DB)
# ============================================================

@app.get("/api/v1/news/by_url", response_model=SingleNewsResponse)
def by_url(
    url: str = Query(
        ...,
        description="Exact article URL that was scraped and stored in DB",
    ),
):
    """
    Fetch a single article from DB by its original URL.
    """
    row = db.get_by_url(url)
    if not row:
        return SingleNewsResponse(found=False, item=None)

    item = _row_to_news_item(row)
    return SingleNewsResponse(found=True, item=item)


# ============================================================
# SENTIMENT: arbitrary text
# ============================================================

@app.post("/api/v1/analyze/sentiment_text", response_model=SentimentResult)
def analyze_sentiment_text(payload: AnalyzeTextRequest):
    """
    Analyze sentiment of arbitrary text and estimate whether it is
    positive/negative towards Bangladesh.
    """
    txt = (payload.text or "").strip()
    if not txt:
        raise HTTPException(status_code=400, detail="Text must not be empty")

    try:
        result = analyze_bangladesh_sentiment(txt)
    except SentimentNotAvailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    return SentimentResult(**result)


# ============================================================
# SENTIMENT: for a stored news article (by URL)
# ============================================================

@app.get("/api/v1/news/sentiment_by_url", response_model=NewsSentimentResponse)
def sentiment_by_url(
    url: HttpUrl = Query(
        ...,
        description="Exact article URL that was scraped and stored in DB",
    )
):
    """
    Fetch article from DB by URL, then run Bangladesh sentiment analysis.

    Uses content if available, else summary, else title.
    """
    row = db.get_by_url(str(url))
    if not row:
        raise HTTPException(status_code=404, detail="Article not found in DB")

    item = _row_to_news_item(row)

    text = item.content or item.summary or item.title
    if not text:
        raise HTTPException(
            status_code=400,
            detail="Article has no content/summary/title to analyze",
        )

    try:
        result = analyze_bangladesh_sentiment(text)
    except SentimentNotAvailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    return NewsSentimentResponse(
        url=item.url,
        title=item.title,
        portal=item.portal,
        sentiment=SentimentResult(**result),
    )
