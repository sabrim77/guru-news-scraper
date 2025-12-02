# core/topic_classifier.py
"""
Rule-based topic classifier for scraped news articles (optional layer).

Design goals:
- Pure function: does NOT touch DB or network.
- Can be used online (during API calls) OR offline (backfill script).
- Returns Optional[str] → None if no confident topic found.

API:
    classify_topic(
        portal: str,
        url: str,
        title: str | None,
        body: str | None,
        *,
        min_score_url: float = 1.0,
        min_score_total: float = 1.0,
    ) -> str | None
"""

from __future__ import annotations

from typing import Optional, Dict, List
import logging
import re

logger = logging.getLogger("topic_classifier")

# ---------------------------------------------------------------------------
# Topic labels (public contract)
# ---------------------------------------------------------------------------

TOPICS: List[str] = [
    "politics",
    "economy",
    "sports",
    "entertainment",
    "crime",
    "education",
    "religion",
    "international",
    "tech",
    "health",
    "environment",
]

# ---------------------------------------------------------------------------
# URL-based hints per topic (English + structural hints)
# ---------------------------------------------------------------------------

URL_KEYWORDS: Dict[str, List[str]] = {
    "sports": [
        "/sports/",
        "/sport/",
        "/cricket/",
        "/football/",
        "/wc-",
        "/world-cup",
        "/t20/",
    ],
    "economy": [
        "/economics/",
        "/business/",
        "/stock-market/",
        "/stockmarket/",
        "/bank/",
        "/corporate/",
        "/economy/",
        "/finance/",
        "/budget/",
    ],
    "entertainment": [
        "/entertainment/",
        "/showbiz/",
        "/lifestyle/",
        "/arts-entertainment/",
        "/culture/",
    ],
    "crime": [
        "/crime/",
        "/crime-justice/",
        "/law-order/",
        "/law-and-order/",
        "/police/",
        "/court/",
        "/high-court/",
        "/supreme-court/",
    ],
    "education": [
        "/education/",
        "/campus/",
        "/university/",
        "/college/",
        "/school/",
        "/admission/",
    ],
    "religion": [
        "/religion/",
        "/islam/",
        "/religious/",
        "/hajj/",
        "/ramadan/",
    ],
    "politics": [
        "/politics/",
        "/national/",
        "/bangladesh/politics/",
        "/election/",
        "/parliament/",
        "/govt/",
        "/government/",
        "/prime-minister/",
        "/prime_minister/",
    ],
    "international": [
        "/international/",
        "/world/",
        "/global/",
        "/rohingya-influx/",
        "/middle-east/",
        "/asia/",
        "/europe/",
        "/usa/",
        "/us-news/",
    ],
    "tech": [
        "/technology/",
        "/sci-tech/",
        "/science-technology/",
        "/ict/",
        "/tech/",
        "/startup/",
    ],
    "health": [
        "/health/",
        "/lifestyle/health/",
        "/healthcare/",
        "/coronavirus/",
        "/covid-19/",
        "/covid19/",
        "/health-news/",
        "/health-and-fitness/",
    ],
    "environment": [
        "/environment/",
        "/climate/",
        "/climate-crisis/",
        "/climate-change/",
        "/weather/",
        "/natural-disaster/",
        "/disaster/",
        "/environment-pollution/",
    ],
}

# ---------------------------------------------------------------------------
# Title/body keyword hints (Bangla + English)
# Now we use them in a *scoring* way instead of “first match wins”.
# ---------------------------------------------------------------------------

TEXT_KEYWORDS: Dict[str, List[str]] = {
    "sports": [
        "খেলা",
        "ক্রিকেট",
        "ফুটবল",
        "টেস্ট ম্যাচ",
        "ওয়ানডে",
        "ওডিআই",
        "টি-টোয়েন্টি",
        "টি টোয়েন্টি",
        "goal",
        "match",
        "tournament",
        "world cup",
        "league",
        "টুর্নামেন্ট",
    ],
    "economy": [
        "অর্থনীতি",
        "শেয়ার বাজার",
        "শেয়ার বাজার",
        "শেয়ারবাজার",
        "স্টক",
        "ব্যাংক",
        "ডলার",
        "মুদ্রাস্ফীতি",
        "loan",
        "interest rate",
        "inflation",
        "economic",
        "stock market",
        "অর্থনৈতিক",
        "বিনিয়োগ",
        "বিনিয়োগ",
        "ব্যবসা",
        "কর্পোরেট",
        "বাজেট",
        "tax",
        "revenue",
    ],
    "entertainment": [
        "অভিনেতা",
        "অভিনেত্রী",
        "নায়িকা",
        "নায়ক",
        "গানের",
        "সিনেমা",
        "ফিল্ম",
        "মডেল",
        "hero",
        "actress",
        "film",
        "movie",
        "drama",
        "showbiz",
        "টেলিফিল্ম",
        "নাটক",
        "বিনোদন",
        "গান",
        "অ্যালবাম",
    ],
    "environment": [
        "বন্যা",
        "প্লাবন",
        "নদী ভাঙন",
        "নদীভাঙন",
        "ভূমিকম্প",
        "earthquake",
        "মাটি কাঁপা",
        "ঘূর্ণিঝড়",
        "ঘূর্ণিঝড়",
        "ঘূর্ণিঝড়ে",
        "ঘূর্ণিঝড়ে",
        "cyclone",
        "সাইক্লোন",
        "টাইফুন",
        "typhoon",
        "tornado",
        "storm",
        "ঝড়",
        "ঝড়",
        "কালবৈশাখী",
        "landslide",
        "ভূমিধস",
        "খরা",
        "drought",
        "heatwave",
        "হিটওয়েভ",
        "হিটওয়েভ",
        "তাপপ্রবাহ",
        "wildfire",
        "বনানলে",
        "বনানল",
        "দূষণ",
        "দূষিত বায়ু",
        "দূষিত বায়ু",
        "air pollution",
        "environment",
        "climate",
        "climate change",
        "global warming",
    ],
    "crime": [
        "খুন",
        "হত্যা",
        "ধর্ষণ",
        "ধর্ষণের",
        "গ্রেপ্তার",
        "গ্রেফতার",
        "ডাকাতি",
        "ছিনতাই",
        "মামলা",
        "জোরপূর্বক",
        "বিস্ফোরণ",
        "বোমা",
        "মর্টার শেল",
        "বিস্ফোরক",
        "অস্ত্রসহ",
        "অস্ত্র",
        "আগ্নেয়াস্ত্র",
        "আগ্নেয়াস্ত্র",
        "গুম",
        "হামলা",
        "লাশ",
        "rape",
        "murder",
        "arrest",
        "police",
        "case filed",
        "case against",
        "bomb blast",
        "explosive",
        "firearms",
        "gun",
        "pistol",
        "rifle",
        "court",
        "high court",
        "supreme court",
    ],
    "health": [
        "হাসপাতাল",
        "হাসপতাল",
        "মেডিকেল কলেজ",
        "চিকিৎসা",
        "রোগী",
        "রোগীকে",
        "ইনজেকশন",
        "বাতের ইনজেকশন",
        "ক্যানসার",
        "ক্যান্সার",
        "ডায়াবেটিস",
        "ডায়াবেটিস",
        "জ্বর",
        "স্বাস্থ্য",
        "স্বাস্থ্যসেবা",
        "চিকিৎসক",
        "ডাক্তার",
        "টিকা",
        "টিকাদান",
        "ভ্যাকসিন",
        "medical college",
        "medical",
        "hospital",
        "health",
        "healthcare",
        "treatment",
        "patients",
        "injection",
        "medicine",
        "medicines",
        "vaccination",
        "vaccine",
        "virus",
        "coronavirus",
        "covid",
        "covid-19",
    ],
    "education": [
        "বিশ্ববিদ্যালয়",
        "বিশ্ববিদ্যালয়",
        "কলেজ",
        "স্কুল",
        "শিক্ষা",
        "ভর্তি",
        "রুয়েট",
        "রুয়েট",
        "ক্যাম্পাস",
        "শিক্ষার্থী",
        "শিক্ষার্থীদের",
        "teacher",
        "teacher recruitment",
        "university",
        "campus",
        "admission",
        "students",
        "exam",
        "পরীক্ষা",
        "বোর্ড পরীক্ষা",
    ],
    "religion": [
        "আল্লাহ",
        "নবী",
        "হজরত",
        "কুরআন",
        "হাদিস",
        "মসজিদ",
        "ওমরাহ",
        "ইসলাম",
        "ধর্মীয়",
        "ধর্মীয়",
        "religion",
        "islam",
        "hajj",
        "eid",
        "রমজান",
        "রোজা",
        "উপাসনা",
    ],
    "politics": [
        "সরকার",
        "সাংসদ",
        "সংসদ",
        "এমপি",
        "নির্বাচন",
        "রাজনীতি",
        "মন্ত্রিসভা",
        "প্রধানমন্ত্রী",
        "মন্ত্রী",
        "দলীয়",
        "দলীয়",
        "দলীয় নেতা",
        "politics",
        "election",
        "parliament",
        "government",
        "cabinet",
        "ruling party",
        "opposition",
        "govt",
        "সভাপতি",
        "সাধারণ সম্পাদক",
        "resign",
        "resignation",
        "minister",
        "mp ",
        "mp,",
    ],
    "international": [
        "জাতিসংঘ",
        "জাতিসংঘের",
        "বিশ্ব",
        "আন্তর্জাতিক",
        "যুক্তরাষ্ট্র",
        "হোয়াইট হাউস",
        "হোয়াইট হাউস",
        "ইউরোপ",
        "মধ্যপ্রাচ্য",
        "united nations",
        "international",
        "global",
        "us president",
        "foreign",
        "world leaders",
        "un chief",
        "বিশ্বব্যাপী",
    ],
    "tech": [
        "প্রযুক্তি",
        "সাইবার",
        "ইন্টারনেট",
        "অ্যাপ",
        "অ্যাপস",
        "স্মার্টফোন",
        "মোবাইল অ্যাপ",
        "গ্যাজেট",
        "technology",
        "software",
        "ai",
        "artificial intelligence",
        "startup",
        "digital",
        "আইটি",
        "আইসিটি",
        "ডাটা",
        "ডেটা",
    ],
}

# ---------------------------------------------------------------------------
# Internal helpers (scoring instead of first-match)
# ---------------------------------------------------------------------------

def _normalize(text: Optional[str]) -> str:
    if not text:
        return ""
    t = text.lower()
    t = re.sub(r"\s+", " ", t)
    return t.strip()


def _init_scores() -> Dict[str, float]:
    return {t: 0.0 for t in TOPICS}


def _score_text(
    text: str,
    mapping: Dict[str, List[str]],
    weight: float,
) -> Dict[str, float]:
    scores = _init_scores()
    if not text:
        return scores

    t = _normalize(text)
    if not t:
        return scores

    for topic, words in mapping.items():
        for w in words:
            if w.lower() in t:
                scores[topic] += weight
    return scores


def _combine_scores(*score_dicts: Dict[str, float]) -> Dict[str, float]:
    combined = _init_scores()
    for s in score_dicts:
        for topic, val in s.items():
            combined[topic] += val
    return combined


def _best_topic(scores: Dict[str, float], min_score: float) -> Optional[str]:
    best_topic: Optional[str] = None
    best_val: float = 0.0

    for topic, val in scores.items():
        if val > best_val:
            best_val = val
            best_topic = topic

    if best_topic is None or best_val < min_score:
        return None
    return best_topic


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def classify_topic(
    portal: str,
    url: str,
    title: Optional[str],
    body: Optional[str],
    *,
    min_score_url: float = 1.0,
    min_score_total: float = 1.0,
) -> Optional[str]:
    """
    Classify topic of an article using weighted rules.

    Args:
        portal: Portal id (e.g. "bbc", "prothomalo").
        url   : Article URL.
        title : Article title (may be empty).
        body  : Article body (may be empty).
        min_score_url  : Minimum score to accept URL-only match.
        min_score_total: Minimum score from (title+body) to accept topic.

    Returns:
        Topic string (e.g. "sports", "politics") OR None if not confident.
    """
    url = url or ""
    title = title or ""
    body = body or ""

    # 1) URL scoring (strongest)
    url_scores = _score_text(url, URL_KEYWORDS, weight=3.0)
    topic_from_url = _best_topic(url_scores, min_score=min_score_url)
    if topic_from_url:
        logger.debug("Topic from URL scoring: %s -> %s", url, topic_from_url)
        return topic_from_url

    # 2) Title + portal scoring (medium)
    combined_title = f"{portal} {title}".strip()
    title_scores = _score_text(combined_title, TEXT_KEYWORDS, weight=2.0)

    # 3) Body scoring (weakest, only if reasonably long)
    body_scores = _init_scores()
    if body and len(body) > 80:
        body_scores = _score_text(body, TEXT_KEYWORDS, weight=1.0)

    total_scores = _combine_scores(title_scores, body_scores)
    topic = _best_topic(total_scores, min_score=min_score_total)

    if topic:
        logger.debug("Topic from text scoring: %s", topic)
    else:
        logger.debug("No confident topic match for URL=%s", url)

    return topic
