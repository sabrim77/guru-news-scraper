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
# Pydantic models
# ============================================================

class NewsItem(BaseModel):
    id: int
    portal: str
    url: HttpUrl
    title: Optional[str] = None
    summary: Optional[str] = None
    content: Optional[str] = None
    topic: Optional[str] = None
    pub_date: Optional[str] = None
    article_pub_date: Optional[str] = None
    author: Optional[str] = None


class PaginatedNews(BaseModel):
    count: int
    limit: int
    offset: int
    items: List[NewsItem]


class SingleNewsResponse(BaseModel):
    found: bool
    item: Optional[NewsItem] = None


# ---------------- Sentiment models ----------------

class SentimentResult(BaseModel):
    label: str
    score: float
    towards_bangladesh: str
    raw_label: str


class AnalyzeTextRequest(BaseModel):
    text: str


class NewsSentimentResponse(BaseModel):
    url: HttpUrl
    title: Optional[str] = None
    portal: Optional[str] = None
    sentiment: SentimentResult


class SentimentOverview(BaseModel):
    total: int
    positive: int
    negative: int
    neutral: int
    unknown: int
    positive_pct: float
    negative_pct: float
    neutral_pct: float
    unknown_pct: float


class FetchedArticle(BaseModel):
    title: str
    url: HttpUrl
    summary: Optional[str] = None
    content: Optional[str] = None
    source: str
    keyword: str
    published_at: Optional[datetime] = None
    sentiment: Optional[SentimentResult] = None


class KeywordFetchResponse(BaseModel):
    raw_query: str
    lang: Optional[str]
    country: Optional[str]
    keywords: List[str]
    total_fetched: int
    by_keyword: Dict[str, List[FetchedArticle]]
    sentiment_overview: Optional[SentimentOverview] = None


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
    db.init_db()


# ============================================================
# Helpers: row → NewsItem
# ============================================================

def _row_to_news_item(row) -> NewsItem:
    def _get(col: str):
        if isinstance(row, dict):
            return row.get(col)
        try:
            if hasattr(row, "keys"):
                if col in row.keys():
                    return row[col]
        except Exception:
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
# LATEST FEED
# ============================================================

@app.get("/api/v1/news/latest", response_model=PaginatedNews)
def latest_news(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    portal: Optional[str] = None,
):
    rows = db.get_latest(limit=limit, offset=offset, portal=portal)
    items = [_row_to_news_item(r) for r in rows]
    return PaginatedNews(count=len(items), limit=limit, offset=offset, items=items)


# ============================================================
# TOPIC FEED
# ============================================================

@app.get("/api/v1/news/by_topic", response_model=PaginatedNews)
def news_by_topic(
    topic: str,
    portal: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
):
    rows = db.get_latest_by_topic(topic=topic, portal=portal, limit=limit, offset=offset)
    items = [_row_to_news_item(r) for r in rows]
    return PaginatedNews(count=len(items), limit=limit, offset=offset, items=items)


# ============================================================
# KEYWORD SEARCH
# ============================================================

@app.get("/api/v1/news/search", response_model=KeywordFetchResponse)
def keyword_search(
    q: str,
    lang: Optional[str] = None,
    country: Optional[str] = None,
):
    lang_param = lang or None
    country_param = country or None

    result = fetch_news_from_user_query(
        user_input=q,
        lang=lang_param,
        country=country_param,
    )

    keywords = result.get("keywords", [])
    total_fetched = result.get("total_fetched", 0)
    raw_by_kw = result.get("by_keyword", {})

    by_keyword_typed: Dict[str, List[FetchedArticle]] = {}
    pos = neg = neu = unk = 0

    for kw, articles in raw_by_kw.items():
        typed_list = []
        for art in articles:
            url_value = art.get("url")
            if not url_value:
                continue  # skip invalid URLs

            base = FetchedArticle(
                title=art.get("title", ""),
                url=url_value,
                summary=art.get("summary"),
                content=art.get("content"),
                source=art.get("source", ""),
                keyword=art.get("keyword", kw),
                published_at=art.get("published_at"),
            )

            text = (base.content or base.summary or base.title or "").strip()
            if not text:
                unk += 1
                typed_list.append(base)
                continue

            try:
                sd = analyze_bangladesh_sentiment(text)
                sent = SentimentResult(**sd)
                base.sentiment = sent

                tb = (sent.towards_bangladesh or "").lower()
                if tb == "positive":
                    pos += 1
                elif tb == "negative":
                    neg += 1
                elif tb == "neutral":
                    neu += 1
                else:
                    unk += 1
            except SentimentNotAvailable:
                unk += 1

            typed_list.append(base)

        by_keyword_typed[kw] = typed_list

    total = pos + neg + neu + unk
    overview = None
    if total > 0:
        overview = SentimentOverview(
            total=total,
            positive=pos,
            negative=neg,
            neutral=neu,
            unknown=unk,
            positive_pct=round(pos * 100 / total, 2),
            negative_pct=round(neg * 100 / total, 2),
            neutral_pct=round(neu * 100 / total, 2),
            unknown_pct=round(unk * 100 / total, 2),
        )

    return KeywordFetchResponse(
        raw_query=q,
        lang=lang_param,
        country=country_param,
        keywords=keywords,
        total_fetched=total_fetched,
        by_keyword=by_keyword_typed,
        sentiment_overview=overview,
    )


# ============================================================
# FETCH BY URL
# ============================================================

@app.get("/api/v1/news/by_url", response_model=SingleNewsResponse)
def by_url(url: str):
    row = db.get_by_url(url)
    if not row:
        return SingleNewsResponse(found=False)
    return SingleNewsResponse(found=True, item=_row_to_news_item(row))


# ============================================================
# SENTIMENT FOR ARBITRARY TEXT
# ============================================================

@app.post("/api/v1/analyze/sentiment_text", response_model=SentimentResult)
def analyze_sentiment_text(payload: AnalyzeTextRequest):
    txt = (payload.text or "").strip()
    if not txt:
        raise HTTPException(status_code=400, detail="Text must not be empty")

    try:
        result = analyze_bangladesh_sentiment(txt)
        return SentimentResult(**result)
    except SentimentNotAvailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))


# ============================================================
# SENTIMENT FOR ARTICLE BY URL
# ============================================================

@app.get("/api/v1/news/sentiment_by_url", response_model=NewsSentimentResponse)
def sentiment_by_url(url: HttpUrl):
    row = db.get_by_url(str(url))
    if not row:
        raise HTTPException(status_code=404, detail="Article not found in DB")

    item = _row_to_news_item(row)
    text = item.content or item.summary or item.title
    if not text:
        raise HTTPException(status_code=400, detail="Article has no analyzable text")

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


# ============================================================
# 🔥 NEW: ANALYTICS OVERVIEW FOR DASHBOARD
# ============================================================

@app.get("/api/v1/analytics/bd_sentiment_overview", response_model=SentimentOverview)
def bd_sentiment_overview(
    limit: int = Query(200, ge=1, le=500),
    portal: Optional[str] = None,
):
    rows = db.get_latest(limit=limit, offset=0, portal=portal)

    pos = neg = neu = unk = 0

    for r in rows:
        item = _row_to_news_item(r)
        text = (item.content or item.summary or item.title or "").strip()

        if not text:
            unk += 1
            continue

        try:
            sd = analyze_bangladesh_sentiment(text)
            sent = SentimentResult(**sd)

            tb = (sent.towards_bangladesh or "").lower()
            if tb == "positive":
                pos += 1
            elif tb == "negative":
                neg += 1
            elif tb == "neutral":
                neu += 1
            else:
                unk += 1

        except SentimentNotAvailable:
            unk += 1

    total = pos + neg + neu + unk
    if total == 0:
        return SentimentOverview(
            total=0, positive=0, negative=0, neutral=0, unknown=0,
            positive_pct=0.0, negative_pct=0.0, neutral_pct=0.0, unknown_pct=0.0,
        )

    return SentimentOverview(
        total=total,
        positive=pos,
        negative=neg,
        neutral=neu,
        unknown=unk,
        positive_pct=round(pos * 100 / total, 2),
        negative_pct=round(neg * 100 / total, 2),
        neutral_pct=round(neu * 100 / total, 2),
        unknown_pct=round(unk * 100 / total, 2),
    )
