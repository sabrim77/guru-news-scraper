# backend/core/bd_sentiment.py

from __future__ import annotations

from typing import Literal, Optional, Dict, Any
import logging

try:
    from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
except Exception as exc:  # transformers not installed / env issue
    AutoTokenizer = None
    AutoModelForSequenceClassification = None
    pipeline = None

logger = logging.getLogger("bd_sentiment")

# 👉 you can change this to your own fine-tuned model later
MODEL_NAME = "nlptown/bert-base-multilingual-uncased-sentiment"

_sentiment_pipe = None


class SentimentNotAvailable(RuntimeError):
    """Raised when transformers/model is not available in this environment."""


def _ensure_pipe():
    """Lazy-load HF pipeline once per process."""
    global _sentiment_pipe

    if _sentiment_pipe is not None:
        return _sentiment_pipe

    if pipeline is None:
        # transformers import failed
        raise SentimentNotAvailable(
            "transformers is not installed or could not be imported"
        )

    logger.info("Loading sentiment model: %s", MODEL_NAME)
    tok = AutoTokenizer.from_pretrained(MODEL_NAME)
    mdl = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)

    _sentiment_pipe = pipeline(
        "sentiment-analysis",
        model=mdl,
        tokenizer=tok,
    )
    return _sentiment_pipe


def analyze_bangladesh_sentiment(
    text: str,
) -> Dict[str, Any]:
    """
    Run sentiment analysis on arbitrary news text.

    Returns:
        {
          "label": "positive" | "negative" | "neutral",
          "score": float,   # confidence 0-1
          "towards_bangladesh": "positive" | "negative" | "neutral" | "unknown",
          "raw_label": str,  # original model label
        }

    NOTE:
        - For now we treat this as general sentiment + a simple heuristic:
          if the text mentions Bangladesh but sentiment is POSITIVE, we mark
          'towards_bangladesh' = 'positive', etc.
        - Later you can replace this with a stance-detection model.
    """
    text = (text or "").strip()
    if not text:
        return {
            "label": "neutral",
            "score": 0.0,
            "towards_bangladesh": "unknown",
            "raw_label": "NONE",
        }

    pipe = _ensure_pipe()
    out = pipe(text[:2000])[0]  # truncate to be safe

    raw_label: str = out["label"]
    score: float = float(out.get("score", 0.0))

    # Map some common label patterns → positive/negative/neutral
    l_lower = raw_label.lower()
    if "1" in l_lower or "2" in l_lower or "neg" in l_lower:
        norm_label: Literal["positive", "negative", "neutral"] = "negative"
    elif "4" in l_lower or "5" in l_lower or "pos" in l_lower:
        norm_label = "positive"
    else:
        norm_label = "neutral"

    # simple heuristic: does it mention Bangladesh?
    mentions_bd = any(
        k in text.lower()
        for k in [
            "bangladesh",
            "বাংলাদেশ",
            "bd",
        ]
    )

    if not mentions_bd:
        towards_bd = "unknown"
    else:
        towards_bd = norm_label

    return {
        "label": norm_label,
        "score": score,
        "towards_bangladesh": towards_bd,
        "raw_label": raw_label,
    }
