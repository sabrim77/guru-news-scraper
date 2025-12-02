// src/pages/news/NewsStoreReports.jsx

import React, { useEffect, useMemo, useState } from "react";
import { apiLatestNews, apiNewsByTopic } from "../../api";

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

export default function NewsStoreReports() {
  const [portal, setPortal] = useState("");
  const [topic, setTopic] = useState("");
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  // Load mode: if topic is set → use /by_topic, else /latest
  const load = async () => {
    setLoading(true);
    setErr(null);

    try {
      const trimmedTopic = topic.trim();
      let res;

      if (trimmedTopic) {
        res = await apiNewsByTopic({
          topic: trimmedTopic,
          limit,
          offset,
          portal: portal || undefined,
        });
      } else {
        res = await apiLatestNews({
          limit,
          offset,
          portal: portal || undefined,
        });
      }

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
  }, [portal, topic, offset]);

  const page = useMemo(() => Math.floor(offset / limit) + 1, [offset, limit]);

  const canPrev = offset > 0;
  const canNext = data ? data.count === limit : false;

  // Simple analytics on the currently loaded page
  const portalStats = useMemo(() => {
    const stats = {};
    if (!data || !Array.isArray(data.items)) return stats;
    for (const item of data.items) {
      const k = item.portal || "unknown";
      stats[k] = (stats[k] || 0) + 1;
    }
    return stats;
  }, [data]);

  const topicStats = useMemo(() => {
    const stats = {};
    if (!data || !Array.isArray(data.items)) return stats;
    for (const item of data.items) {
      const k = item.topic || "none";
      stats[k] = (stats[k] || 0) + 1;
    }
    return stats;
  }, [data]);

  const totalItems = data?.items?.length || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          News Store &amp; Reports
        </h1>
        <p className="text-sm text-slate-400">
          Browse stored articles from SQLite and view lightweight per-page
          analytics by portal and topic.
        </p>
      </div>

      {/* Filters */}
      <section className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap gap-2 text-xs">
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

          <input
            type="text"
            className="border border-slate-700 rounded-full px-3 py-1 text-xs bg-slate-900 text-slate-100 flex-1 min-w-[180px]"
            placeholder="Optional topic filter (e.g. politics, sports, health)"
            value={topic}
            onChange={(e) => {
              setOffset(0);
              setTopic(e.target.value);
            }}
          />

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-3 py-1 rounded-full bg-sky-600 text-slate-50 disabled:opacity-60"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <p className="text-[11px] text-slate-500">
          Data source:{" "}
          {topic.trim() ? (
            <>
              <code className="text-sky-300">/api/v1/news/by_topic</code>{" "}
              (topic=&quot;{topic.trim()}&quot;)
            </>
          ) : (
            <code className="text-sky-300">/api/v1/news/latest</code>
          )}{" "}
          • limit {limit} • page {page}
        </p>
      </section>

      {/* Main content + analytics */}
      <section className="grid gap-4 lg:grid-cols-3">
        {/* Articles list */}
        <div className="lg:col-span-2 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-2 text-xs text-slate-400">
            <span>
              Showing{" "}
              <span className="font-semibold text-slate-100">
                {totalItems}
              </span>{" "}
              item(s)
              {portal && (
                <>
                  {" "}
                  from{" "}
                  <span className="font-semibold text-slate-100">
                    {portal}
                  </span>
                </>
              )}
              {topic.trim() && (
                <>
                  {" "}
                  • topic:{" "}
                  <span className="font-semibold text-slate-100">
                    {topic.trim()}
                  </span>
                </>
              )}
            </span>
            <span className="font-mono">page {page}</span>
          </div>

          {err && (
            <p className="text-xs text-red-400 mb-2">Error: {err}</p>
          )}
          {!err && loading && (
            <p className="text-xs text-slate-400 mb-2">
              Loading stored articles…
            </p>
          )}

          {!loading && !err && totalItems === 0 && (
            <p className="text-xs text-slate-500">
              No articles found for current filters. Try clearing topic/portal
              or run the scraper / keyword fetch first.
            </p>
          )}

          <div className="flex-1 overflow-y-auto max-h-[480px] space-y-2 mt-1">
            {data?.items?.map((item) => (
              <article
                key={item.id}
                className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs"
              >
                <div className="flex justify-between gap-2">
                  <div className="text-[13px] font-semibold leading-snug text-slate-50">
                    {item.title || "(no title)"}
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-200 text-[10px] font-medium">
                      {item.portal}
                    </span>
                    {item.topic && (
                      <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-200 text-[10px] font-medium">
                        topic: {item.topic}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-right text-slate-400 whitespace-nowrap">
                    {item.pub_date && (
                      <div>RSS: {prettyDate(item.pub_date)}</div>
                    )}
                    {item.article_pub_date && (
                      <div>HTML: {prettyDate(item.article_pub_date)}</div>
                    )}
                  </div>
                </div>

                {item.summary && (
                  <p className="text-[12px] text-slate-300 mt-1 line-clamp-3">
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

          {/* Pagination controls */}
          <div className="flex items-center gap-2 mt-3 text-xs text-slate-300">
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
        </div>

        {/* Analytics panel */}
        <div className="space-y-4">
          {/* Summary card */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
            <h2 className="text-sm font-semibold mb-1 text-slate-100">
              Snapshot
            </h2>
            <p className="text-[11px] text-slate-400 mb-2">
              Lightweight stats on the currently loaded page (not whole DB).
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2">
                <div className="text-[10px] text-slate-400">Items</div>
                <div className="text-lg font-semibold text-slate-50">
                  {totalItems}
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2">
                <div className="text-[10px] text-slate-400">Portals</div>
                <div className="text-lg font-semibold text-slate-50">
                  {Object.keys(portalStats).length || 0}
                </div>
              </div>
            </div>
          </div>

          {/* Portal distribution */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
            <h2 className="text-sm font-semibold mb-2 text-slate-100">
              Per-Portal Counts
            </h2>
            {Object.keys(portalStats).length === 0 ? (
              <p className="text-[11px] text-slate-500">
                No data yet. Once articles appear, you&apos;ll see distribution
                per portal here.
              </p>
            ) : (
              <ul className="space-y-1 text-[11px] text-slate-300">
                {Object.entries(portalStats).map(([p, count]) => (
                  <li
                    key={p}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{p}</span>
                    <span className="font-mono text-slate-100">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Topic distribution */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
            <h2 className="text-sm font-semibold mb-2 text-slate-100">
              Per-Topic Counts
            </h2>
            {Object.keys(topicStats).length === 0 ? (
              <p className="text-[11px] text-slate-500">
                No topic labels yet. When your classifier writes topics to DB,
                they will appear here.
              </p>
            ) : (
              <ul className="space-y-1 text-[11px] text-slate-300">
                {Object.entries(topicStats).map(([t, count]) => (
                  <li
                    key={t}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{t}</span>
                    <span className="font-mono text-slate-100">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
