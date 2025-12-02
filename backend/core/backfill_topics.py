# backfill_topics.py
"""
Offline topic backfill.

Usage:
    python backfill_topics.py
"""

from __future__ import annotations

import logging
from typing import Any, Dict

from core import db
from core.topic_classifier import classify_topic

logging.basicConfig(
    level=logging.INFO,
    format="[%(levelname)s] %(asctime)s | %(message)s",
)

log = logging.getLogger("backfill_topics")


def fetch_unclassified(limit: int = 200) -> list[Dict[str, Any]]:
    conn = db._get_conn()  # internal but fine for a utility script
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, portal, url, title, content, topic
        FROM news
        WHERE topic IS NULL OR topic = ''
        ORDER BY id DESC
        LIMIT ?;
        """,
        (limit,),
    )
    return [dict(r) for r in cur.fetchall()]


def update_topic(row_id: int, topic: str | None) -> None:
    if topic is None:
        return
    conn = db._get_conn()
    cur = conn.cursor()
    cur.execute(
        "UPDATE news SET topic = ? WHERE id = ?;",
        (topic, row_id),
    )
    conn.commit()


def main() -> None:
    db.init_db()
    total_updated = 0

    while True:
        batch = fetch_unclassified(limit=200)
        if not batch:
            break

        log.info("Processing batch of %d rows", len(batch))

        for row in batch:
            topic = classify_topic(
                portal=row["portal"],
                url=row["url"],
                title=row.get("title") or "",
                body=row.get("content") or "",
            )

            if topic:
                update_topic(row["id"], topic)
                total_updated += 1
                log.info("Row %s → topic=%s", row["id"], topic)

    log.info("Done. Total rows updated with topic = %d", total_updated)


if __name__ == "__main__":
    main()
