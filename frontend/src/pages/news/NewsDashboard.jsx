// src/pages/news/NewsDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  apiHealth,
  apiLatestNews,
  apiNewsByTopic,
  apiKeywordFetch,
} from "../../api";

const PORTAL_OPTIONS = [
  { label: "All portals", value: "" },
  { label: "Prothom Alo", value: "prothomalo" },
  { label: "Kaler Kantho", value: "kalerkantho" },
  { label: "RisingBD", value: "risingbd" },
  { label: "JagoNews24", value: "jagonews24" },
  { label: "BBC", value: "bbc" },
];

function prettyDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function NewsDashboard() {
  const [activeTab, setActiveTab] = useState("latest"); // 'latest' | 'topic' | 'keyword'
  const [health, setHealth] = useState("checking…");

  useEffect(() => {
    apiHealth()
      .then((res) => setHealth(res.status))
      .catch((err) => setHealth("error: " + err.message));
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          News Aggregation Dashboard
        </h1>
        <p className="text-xs text-slate-400">
          FastAPI · SQLite · Hybrid Scraper · Keyword &amp; Topic feeds
        </p>
        <p className="text-xs text-slate-400 mt-1">
          API health:{" "}
          <span className="font-medium text-emerald-400">{health}</span>
        </p>
      </div>

      {/* Tabs */}
      <div className="inline-flex rounded-full bg-slate-900 border border-slate-700 p-1 text-xs font-medium w-fit">
        <button
          onClick={() => setActiveTab("latest")}
          className={
            "px-3 py-1 rounded-full transition " +
            (activeTab === "latest"
              ? "bg-sky-500 text-slate-950"
              : "text-slate-300 hover:text-slate-50")
          }
        >
          Latest (DB)
        </button>
        <button
          onClick={() => setActiveTab("topic")}
          className={
            "px-3 py-1 rounded-full transition " +
            (activeTab === "topic"
              ? "bg-sky-500 text-slate-950"
              : "text-slate-300 hover:text-slate-50")
          }
        >
          Topic Feed (DB)
        </button>
        <button
          onClick={() => setActiveTab("keyword")}
          className={
            "px-3 py-1 rounded-full transition " +
            (activeTab === "keyword"
              ? "bg-sky-500 text-slate-950"
              : "text-slate-300 hover:text-slate-50")
          }
        >
          Keyword Fetch (RSS)
        </button>
      </div>

      {/* Tab content */}
      <div className="mt-1">
        {activeTab === "latest" && <LatestTab />}
        {activeTab === "topic" && <TopicTab />}
        {activeTab === "keyword" && <KeywordTab />}
      </div>
    </div>
  );
}

/* --------------------- Latest (DB) --------------------- */

function LatestTab() {
  const [portal, setPortal] = useState("");
  const [limit] = useState(10);
  const [offset, setOffset] = useState(0);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const page = useMemo(() => Math.floor(offset / limit) + 1, [offset, limit]);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await apiLatestNews({
        limit,
        offset,
        portal: portal || undefined,
      });
      setData(res);
    } catch (e) {
      setErr(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portal, offset]);

  const canPrev = offset > 0;
  const canNext = data ? data.count === limit : false;

  return (
    <section className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
      <div className="flex flex-wrap gap-2 mb-2 text-xs">
        <select
          className="border border-slate-700 rounded-full px-3 py-1 text-xs bg-slate-900 text-slate-100"
          value={portal}
          onChange={(e) => {
            setOffset(0);
            setPortal(e.target.value);
          }}
        >
          {PORTAL_OPTIONS.map((p) => (
            <option key={p.value || "all"} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-1 rounded-full bg-sky-600 text-slate-50 disabled:opacity-60"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {err && <p className="text-xs text-red-400">Error: {err}</p>}
      {!err && loading && (
        <p className="text-xs text-slate-400">Loading latest news…</p>
      )}

      {data && (
        <>
          <p className="text-xs text-slate-400 mb-1">
            Showing{" "}
            <span className="font-semibold text-slate-100">
              {data.items.length}
            </span>{" "}
            item(s)
            {portal && (
              <>
                {" "}
                from{" "}
                <span className="font-semibold text-slate-100">{portal}</span>
              </>
            )}{" "}
            · page {page}
          </p>
          <NewsList items={data.items} />

          <div className="flex items-center gap-2 mt-2 text-xs text-slate-300">
            <button
              disabled={!canPrev || loading}
              onClick={() => setOffset((o) => Math.max(0, o - limit))}
              className="px-2 py-1 rounded-full border border-slate-700 bg-slate-900 disabled:opacity-50"
            >
              Prev
            </button>
            <span>Page {page}</span>
            <button
              disabled={!canNext || loading}
              onClick={() => setOffset((o) => o + limit)}
              className="px-2 py-1 rounded-full border border-slate-700 bg-slate-900 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}

      {!loading && !err && (!data || data.items.length === 0) && (
        <p className="text-xs text-slate-500">
          No news yet. Run your scraper / keyword fetch first.
        </p>
      )}
    </section>
  );
}

/* --------------------- Topic (DB) --------------------- */

function TopicTab() {
  const [topic, setTopic] = useState("politics");
  const [portal, setPortal] = useState("");
  const [limit] = useState(10);
  const [offset, setOffset] = useState(0);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const page = useMemo(() => Math.floor(offset / limit) + 1, [offset, limit]);

  const load = async () => {
    const t = topic.trim();
    if (!t) {
      setData(null);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const res = await apiNewsByTopic({
        topic: t,
        limit,
        offset,
        portal: portal || undefined,
      });
      setData(res);
    } catch (e) {
      setErr(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (topic.trim()) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, portal, offset]);

  const canPrev = offset > 0;
  const canNext = data ? data.count === limit : false;

  return (
    <section className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
      <div className="flex flex-wrap gap-2 mb-2 text-xs">
        <input
          type="text"
          className="border border-slate-700 rounded-full px-3 py-1 text-xs bg-slate-900 text-slate-100 flex-1 min-w-[180px]"
          placeholder="Topic label (e.g. politics, sports, health)"
          value={topic}
          onChange={(e) => {
            setOffset(0);
            setTopic(e.target.value);
          }}
        />
        <select
          className="border border-slate-700 rounded-full px-3 py-1 text-xs bg-slate-900 text-slate-100"
          value={portal}
          onChange={(e) => {
            setOffset(0);
            setPortal(e.target.value);
          }}
        >
          {PORTAL_OPTIONS.map((p) => (
            <option key={p.value || "all"} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          onClick={load}
          disabled={loading || !topic.trim()}
          className="px-3 py-1 rounded-full bg-sky-600 text-slate-50 disabled:opacity-60"
        >
          {loading ? "Loading…" : "Load topic"}
        </button>
      </div>

      {err && <p className="text-xs text-red-400">Error: {err}</p>}
      {!err && loading && (
        <p className="text-xs text-slate-400">Loading topic news…</p>
      )}

      {data && (
        <>
          <p className="text-xs text-slate-400 mb-1">
            Topic{" "}
            <span className="font-semibold text-slate-100">{topic}</span> ·{" "}
            {data.items.length} item(s)
            {portal && (
              <>
                {" "}
                from{" "}
                <span className="font-semibold text-slate-100">{portal}</span>
              </>
            )}{" "}
            · page {page}
          </p>
          <NewsList items={data.items} />

          <div className="flex items-center gap-2 mt-2 text-xs text-slate-300">
            <button
              disabled={!canPrev || loading}
              onClick={() => setOffset((o) => Math.max(0, o - limit))}
              className="px-2 py-1 rounded-full border border-slate-700 bg-slate-900 disabled:opacity-50"
            >
              Prev
            </button>
            <span>Page {page}</span>
            <button
              disabled={!canNext || loading}
              onClick={() => setOffset((o) => o + limit)}
              className="px-2 py-1 rounded-full border border-slate-700 bg-slate-900 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}

      {!loading &&
        !err &&
        (!data || data.items.length === 0) &&
        topic.trim() && (
          <p className="text-xs text-slate-500">
            No news found for topic &quot;{topic}&quot;.
          </p>
        )}
    </section>
  );
}

/* --------------------- Keyword Fetch (RSS) --------------------- */

function KeywordTab() {
  const [q, setQ] = useState("US Navy");
  const [lang, setLang] = useState("");
  const [country, setCountry] = useState("");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const handleFetch = async () => {
    const trimmed = q.trim();
    if (!trimmed) return;

    setLoading(true);
    setErr(null);
    setData(null);

    try {
      const res = await apiKeywordFetch({
        q: trimmed,
        lang: lang || undefined,
        country: country || undefined,
      });

      // Defensive: normalize shape to what we expect
      const safe = {
        raw_query: res.raw_query ?? trimmed,
        lang: res.lang ?? null,
        country: res.country ?? null,
        keywords: Array.isArray(res.keywords) ? res.keywords : [],
        total_fetched:
          typeof res.total_fetched === "number" ? res.total_fetched : 0,
        by_keyword:
          typeof res.by_keyword === "object" && res.by_keyword !== null
            ? res.by_keyword
            : {},
      };

      setData(safe);
    } catch (e) {
      setErr(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
      <div className="flex flex-wrap gap-2 mb-2 text-xs">
        <input
          type="text"
          className="border border-slate-700 rounded-full px-3 py-1 text-xs bg-slate-900 text-slate-100 flex-1 min-w-[200px]"
          placeholder="Keywords or comma-separated list (e.g. US Navy, Bangladesh)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="border border-slate-700 rounded-full px-3 py-1 text-xs bg-slate-900 text-slate-100"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
        >
          <option value="">All langs</option>
          <option value="en">English</option>
          <option value="bn">Bangla</option>
        </select>
        <select
          className="border border-slate-700 rounded-full px-3 py-1 text-xs bg-slate-900 text-slate-100"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        >
          <option value="">All countries</option>
          <option value="bd">Bangladesh</option>
          <option value="intl">International</option>
        </select>
        <button
          onClick={handleFetch}
          disabled={loading || !q.trim()}
          className="px-3 py-1 rounded-full bg-sky-600 text-slate-50 disabled:opacity-60"
        >
          {loading ? "Fetching…" : "Fetch from RSS"}
        </button>
      </div>

      {err && <p className="text-xs text-red-400">Error: {err}</p>}
      {!err && loading && (
        <p className="text-xs text-slate-400">
          Fetching fresh articles from portals&apos; RSS feeds…
        </p>
      )}

      {data && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">
            Raw query:{" "}
            <span className="font-semibold text-slate-100">
              {data.raw_query}
            </span>{" "}
            · keywords:{" "}
            {data.keywords.length > 0
              ? data.keywords.join(", ")
              : "none"}{" "}
            · total fetched:{" "}
            <span className="font-semibold text-slate-100">
              {data.total_fetched}
            </span>
          </p>

          {data.keywords.map((kw) => {
            const articles = data.by_keyword[kw] || [];
            return (
              <div key={kw} className="mt-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-200 text-[11px] font-medium">
                  keyword: {kw}
                </span>
                {articles.length === 0 ? (
                  <p className="text-[11px] text-slate-500 mt-1">
                    No articles for this keyword.
                  </p>
                ) : (
                  <KeywordNewsList items={articles} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && !err && !data && (
        <p className="text-xs text-slate-500">
          Type a keyword (Bangla/English/mixed) and fetch news live from RSS.
        </p>
      )}
    </section>
  );
}

/* --------------------- Shared list components --------------------- */

function NewsList({ items }) {
  return (
    <div className="space-y-2 mt-1">
      {items.map((item) => (
        <article
          key={item.id}
          className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2"
        >
          <div className="flex justify-between gap-2">
            <div className="text-sm font-semibold leading-snug text-slate-50">
              {item.title || "(no title)"}
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-200 text-[11px] font-medium">
                {item.portal}
              </span>
              {item.topic && (
                <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-200 text-[11px] font-medium">
                  topic: {item.topic}
                </span>
              )}
            </div>
            <div className="text-[11px] text-right text-slate-400 whitespace-nowrap">
              {item.pub_date && <div>RSS: {prettyDate(item.pub_date)}</div>}
              {item.article_pub_date && (
                <div>HTML: {prettyDate(item.article_pub_date)}</div>
              )}
            </div>
          </div>

          {item.summary && (
            <p className="text-[13px] text-slate-300 mt-1 line-clamp-3">
              {item.summary}
            </p>
          )}

          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="text-sky-400 hover:underline"
            >
              Open article ↗
            </a>
            <span>{item.author && <>By {item.author}</>}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

function KeywordNewsList({ items }) {
  return (
    <div className="space-y-2 mt-1">
      {items.map((item, idx) => (
        <article
          key={`${item.url}-${idx}`}
          className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2"
        >
          <div className="flex justify-between gap-2">
            <div className="text-sm font-semibold leading-snug text-slate-50">
              {item.title || "(no title)"}
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-200 text-[11px] font-medium">
                {item.source}
              </span>
            </div>
            <div className="text-[11px] text-right text-slate-400 whitespace-nowrap">
              {item.published_at && (
                <div>Pub: {prettyDate(item.published_at)}</div>
              )}
            </div>
          </div>

          {item.summary && (
            <p className="text-[13px] text-slate-300 mt-1 line-clamp-3">
              {item.summary}
            </p>
          )}

          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="text-sky-400 hover:underline"
            >
              Open article ↗
            </a>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-200 text-[11px] font-medium">
              kw: {item.keyword}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
