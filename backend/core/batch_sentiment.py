# backend/core/batch_sentiment.py
# ------------------------------------------------------------
# Batch sentiment processing using safe public-mode sentiment
# ------------------------------------------------------------

from __future__ import annotations
import sqlite3
from pathlib import Path
from typing import Optional, Dict, Any

from core import db
from core.bd_sentiment import analyze_bangladesh_sentiment, SentimentNotAvailable


def get_connection() -> sqlite3.Connection:
    for attr in ("get_connection", "get_conn"):
        if hasattr(db, attr):
            conn = getattr(db, attr)()
            if isinstance(conn, sqlite3.Connection):
                return conn

    db_path = None
    for attr in ("DB_PATH", "DB_FILE", "DB_NAME"):
        if hasattr(db, attr):
            db_path = Path(getattr(db, attr))
            break

    if db_path is None:
        db_path = Path("news.db")

    db_path = db_path.resolve()
    print(f"[batch_sentiment] Using DB: {db_path}")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_sentiment_columns(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(news);")
    cols = {row[1] for row in cur.fetchall()}

    to_add = []

    if "sentiment_label" not in cols:
        to_add.append("ALTER TABLE news ADD COLUMN sentiment_label TEXT;")

    if "sentiment_score" not in cols:
        to_add.append("ALTER TABLE news ADD COLUMN sentiment_score REAL;")

    if "towards_bangladesh" not in cols:
        to_add.append("ALTER TABLE news ADD COLUMN towards_bangladesh TEXT;")

    if "sentiment_raw_label" not in cols:
        to_add.append("ALTER TABLE news ADD COLUMN sentiment_raw_label TEXT;")

    for stmt in to_add:
        print(f"[batch_sentiment] Executing: {stmt}")
        cur.execute(stmt)

    if to_add:
        conn.commit()
        print("[batch_sentiment] Schema updated.")
    else:
        print("[batch_sentiment] Sentiment columns already OK.")


def fetch_unlabeled_batch(conn, last_id: int, batch_size: int = 32):
    sql = """
        SELECT *
        FROM news
        WHERE (sentiment_label IS NULL OR sentiment_label = '')
          AND id > ?
        ORDER BY id
        LIMIT ?
    """
    cur = conn.cursor()
    cur.execute(sql, (last_id, batch_size))
    return cur.fetchall()


def update_sentiment_row(conn, article_id: int, result: Dict[str, Any]):
    sql = """
        UPDATE news
        SET sentiment_label = ?,
            sentiment_score = ?,
            towards_bangladesh = ?,
            sentiment_raw_label = ?
        WHERE id = ?
    """
    conn.execute(sql, (
        result.get("label"),
        float(result.get("score", 0.0)),
        result.get("towards_bangladesh"),
        result.get("raw_label"),
        article_id,
    ))


def process_batch(conn, batch_size: int = 32) -> int:
    total_processed = 0
    last_id = 0

    while True:
        rows = fetch_unlabeled_batch(conn, last_id, batch_size)
        if not rows:
            break

        print(f"[batch_sentiment] Processing {len(rows)} items...")

        for row in rows:
            article_id = row["id"]
            text = row["content"] or row["summary"] or row["title"] or ""

            if not text.strip():
                update_sentiment_row(conn, article_id, {
                    "label": "neutral",
                    "score": 0.0,
                    "towards_bangladesh": "unknown",
                    "raw_label": "NO_TEXT",
                })
                total_processed += 1
                continue

            result = analyze_bangladesh_sentiment(text)
            update_sentiment_row(conn, article_id, result)
            total_processed += 1

            print(f"  -> id={article_id}: {result}")

        conn.commit()
        last_id = rows[-1]["id"]

    return total_processed


def main() -> None:
    conn = get_connection()
    try:
        ensure_sentiment_columns(conn)
        total = process_batch(conn)
        print(f"[batch_sentiment] Done. Updated rows: {total}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
