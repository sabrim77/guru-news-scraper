# backend/core/bd_sentiment.py
# ------------------------------------------------------------
# SAFEST PUBLIC-MODE SENTIMENT (NO TRANSFORMERS, NO DOWNLOADS)
# ------------------------------------------------------------

from typing import Dict, Any

class SentimentNotAvailable(RuntimeError):
    pass

# Simple keyword lists — multilingual & lightweight
POSITIVE_WORDS = [
    "good", "great", "excellent", "positive", "success",
    "উন্নতি", "লাভ", "অগ্রগতি", "স্বস্তি", "উন্নয়ন",
]

NEGATIVE_WORDS = [
    "bad", "terrible", "worst", "negative", "crisis",
    "loss", "ক্ষতি", "সমস্যা", "সংকট", "দুর্ভোগ",
]

BD_KEYWORDS = [
    "bangladesh", "বাংলাদেশ", "bd"
]


def analyze_bangladesh_sentiment(text: str) -> Dict[str, Any]:
    """
    100% SAFE: No ML model. Always returns sentiment.
    Works offline. Works on any machine. Never crashes.
    """

    if not text:
        return {
            "label": "neutral",
            "score": 0.0,
            "towards_bangladesh": "unknown",
            "raw_label": "NONE",
        }

    t = text.lower()

    # Count positive/negative hits
    pos_hits = sum(w in t for w in POSITIVE_WORDS)
    neg_hits = sum(w in t for w in NEGATIVE_WORDS)

    if pos_hits > neg_hits:
        label = "positive"
        score = 0.75
    elif neg_hits > pos_hits:
        label = "negative"
        score = 0.75
    else:
        label = "neutral"
        score = 0.50

    # Bangladesh stance
    mentions_bd = any(bd in t for bd in BD_KEYWORDS)

    if not mentions_bd:
        towards_bd = "unknown"
    else:
        towards_bd = label

    return {
        "label": label,
        "score": score,
        "towards_bangladesh": towards_bd,
        "raw_label": label.upper(),
    }
