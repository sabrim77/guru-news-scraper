# debug_db.py
from core import db

def main():
    db.init_db()
    print("Total rows in news table:", db.count())
    print()

    # 1) Show per-portal counts
    conn = db._get_conn()  # internal but OK for debugging
    cur = conn.cursor()
    cur.execute("SELECT portal, COUNT(*) AS c FROM news GROUP BY portal ORDER BY c DESC;")
    rows = cur.fetchall()

    print("=== Counts by portal ===")
    for r in rows:
        print(f"{r['portal']}: {r['c']}")

    print("\n=== Latest 5 from BBC (if any) ===")
    cur.execute(
        """
        SELECT portal, title, substr(content, 1, 120) AS snippet, pub_date
        FROM news
        WHERE portal = ?
        ORDER BY id DESC
        LIMIT 5;
        """,
        ("bbc",),
    )
    for r in cur.fetchall():
        print("\nPortal:", r["portal"])
        print("Title :", r["title"])
        print("Date  :", r["pub_date"])
        print("Body  :", (r["snippet"] or "").replace("\n", " ") + "...")

if __name__ == "__main__":
    main()
