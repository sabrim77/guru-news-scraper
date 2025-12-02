// src/pages/news/NewsStoreReports.jsx

import React, { useEffect, useMemo, useState } from "react";
import { apiLatestNews, apiNewsByTopic } from "../../api";
import {
  Filter,
  RefreshCcw,
  ExternalLink,
  BarChart3,
  Eye,
  FileText,
  X,
  Activity,
} from "lucide-react";

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

function computeArticleStats(item) {
  const text = [
    item.title || "",
    item.summary || "",
    item.content || "",
  ].join(" ");

  const words = text
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
  const wordCount = words.length;
  const charCount = text.length;

  // simple read time: 200 wpm
  const minutes = wordCount / 200;
  const readMinutes = minutes < 1 ? "<1" : Math.round(minutes);

  const bangladeshRegex = /(bangladesh|বাংলাদেশ)/i;
  const mentionsBangladesh = bangladeshRegex.test(text);

  return {
    wordCount,
    charCount,
    readMinutes,
    mentionsBangladesh,
  };
}

export default function NewsStoreReports() {
  const [portal, setPortal] = useState("");
  const [topic, setTopic] = useState("");
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  // inspector state
  const [inspectedItem, setInspectedItem] = useState(null); // article row
  const [inspectorTab, setInspectorTab] = useState("preview"); // "preview" | "analysis"

  const closeInspector = () => {
    setInspectedItem(null);
  };

  // load mode: topic → /by_topic, else /latest
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

  const items = data?.items || [];
  const totalItems = items.length;

  // analytics
  const portalStats = useMemo(() => {
    const stats = {};
    if (!items.length) return stats;
    for (const item of items) {
      const k = item.portal || "unknown";
      stats[k] = (stats[k] || 0) + 1;
    }
    return stats;
  }, [items]);

  const topicStats = useMemo(() => {
    const stats = {};
    if (!items.length) return stats;
    for (const item of items) {
      const k = item.topic || "none";
      stats[k] = (stats[k] || 0) + 1;
    }
    return stats;
  }, [items]);

  return (
    <div className="space-y-5">
      {/* PAGE HEADER */}
      <div>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-50">
          News Store &amp; Reports
        </h1>
        <p className="text-sm text-slate-400">
          View stored news articles, filter by portal/topic, quickly preview
          content, and run on-the-fly analysis.
        </p>
      </div>

      {/* MAIN CARD – "SAVED SESSIONS" STYLE */}
      <section className="bg-slate-950/90 border border-slate-800 rounded-2xl shadow-xl p-4 md:p-5 space-y-4">
        {/* CARD HEADER BAR */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-indigo-500/15 border border-indigo-500/60 flex items-center justify-center">
              <FileText className="h-4 w-4 text-indigo-300" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-semibold text-slate-50">
                Saved News Sessions
              </h2>
              <p className="text-[11px] text-slate-500">
                This view shows the latest stored articles from your SQLite
                store (page-level, not full DB).
              </p>
            </div>
          </div>

          {/* top-right: filters summary + refresh */}
          <div className="flex flex-wrap items-center gap-2 justify-end text-[11px] text-slate-400">
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-slate-700 bg-slate-900/80">
              <Filter className="h-3 w-3 text-slate-500" />
              <span>
                Portal:{" "}
                <span className="text-slate-200 font-medium">
                  {portal || "All"}
                </span>
              </span>
              {topic.trim() && (
                <>
                  <span className="mx-1 text-slate-600">•</span>
                  <span>
                    Topic:{" "}
                    <span className="text-slate-200 font-medium">
                      {topic.trim()}
                    </span>
                  </span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-full border border-sky-500/60 bg-sky-500/10 px-3 py-1.5 text-[11px] font-medium text-sky-200 hover:bg-sky-500/20 disabled:opacity-50"
            >
              <RefreshCcw
                className={`h-3.5 w-3.5 ${
                  loading ? "animate-spin" : ""
                }`}
              />
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* FILTER BAR */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-3 flex flex-wrap gap-3 items-center text-xs">
          <select
            className="border border-slate-700 rounded-full px-3 py-1 bg-slate-900 text-slate-100 min-w-[150px]"
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
            className="border border-slate-700 rounded-full px-3 py-1 bg-slate-900 text-slate-100 flex-1 min-w-[180px]"
            placeholder="Optional topic filter (e.g. politics, sports, health)…"
            value={topic}
            onChange={(e) => {
              setOffset(0);
              setTopic(e.target.value);
            }}
          />

          <div className="ml-auto flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span>
              Source:{" "}
              <code className="text-sky-300">
                {topic.trim()
                  ? "/api/v1/news/by_topic"
                  : "/api/v1/news/latest"}
              </code>
            </span>
            <span className="hidden sm:inline">
              • limit {limit} • page {page}
            </span>
          </div>
        </div>

        {/* TABLE + PAGINATION */}
        <div className="border border-slate-800 rounded-2xl bg-slate-950/90 overflow-hidden">
          {/* table header */}
          <div className="hidden md:grid grid-cols-[minmax(0,2.3fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_150px] gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-800 bg-slate-950">
            <span>Session / Title</span>
            <span>Keywords / Topic</span>
            <span>Sources</span>
            <span>Created</span>
            <span className="text-right pr-2">Actions</span>
          </div>

          {/* body */}
          <div className="max-h-[480px] overflow-y-auto divide-y divide-slate-800">
            {err && (
              <div className="px-4 py-3 text-xs text-red-400">
                Error: {err}
              </div>
            )}

            {!err && loading && (
              <div className="px-4 py-4 text-xs text-slate-400">
                Loading stored articles…
              </div>
            )}

            {!loading && !err && totalItems === 0 && (
              <div className="px-4 py-4 text-xs text-slate-500">
                No articles found for current filters. Try clearing
                topic/portal or run the scraper / keyword fetch first.
              </div>
            )}

            {!loading &&
              !err &&
              items.map((item) => {
                const created =
                  item.article_pub_date ||
                  item.pub_date ||
                  item.created_at;
                const kwDisplay =
                  item.topic ||
                  (item.summary && item.summary.slice(0, 40) + "…") ||
                  "(no topic)";
                return (
                  <div
                    key={item.id}
                    className="px-4 py-2.5 text-[11px] md:grid md:grid-cols-[minmax(0,2.3fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_150px] md:gap-3 hover:bg-slate-900/70 transition-colors flex flex-col gap-2"
                  >
                    {/* session / title */}
                    <div className="flex flex-col">
                      <span className="text-[13px] font-semibold text-slate-50 truncate">
                        {item.title || "(no title)"}
                      </span>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-sky-500/12 text-sky-200 text-[10px] font-medium">
                          ID #{item.id}
                        </span>
                        {item.sentiment_label && (
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              item.sentiment_label === "positive"
                                ? "bg-emerald-500/15 text-emerald-300"
                                : item.sentiment_label === "negative"
                                ? "bg-rose-500/15 text-rose-300"
                                : item.sentiment_label === "neutral"
                                ? "bg-amber-500/15 text-amber-300"
                                : "bg-slate-500/15 text-slate-300"
                            }`}
                          >
                            sentiment: {item.sentiment_label}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* keywords / topic */}
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-200 text-[10px] font-medium max-w-full truncate">
                        {kwDisplay}
                      </span>
                    </div>

                    {/* sources */}
                    <div className="flex items-center gap-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-200 text-[10px] font-medium">
                        {item.portal || "unknown"}
                      </span>
                      {item.towards_bangladesh && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-cyan-500/12 text-cyan-200 text-[10px] font-medium">
                          towards: {item.towards_bangladesh}
                        </span>
                      )}
                    </div>

                    {/* created date */}
                    <div className="text-slate-400 text-[10px] whitespace-nowrap">
                      {created ? prettyDate(created) : "—"}
                    </div>

                    {/* actions */}
                    <div className="flex items-center justify-start md:justify-end gap-1.5">
                      {/* open article */}
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-200 hover:border-sky-500/80 hover:bg-sky-500/10 hover:text-sky-200 transition"
                        title="Open original article"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>

                      {/* quick analysis */}
                      <button
                        type="button"
                        onClick={() => {
                          setInspectedItem(item);
                          setInspectorTab("analysis");
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-500/70 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20 hover:border-emerald-400 transition"
                        title="Quick analysis"
                      >
                        <BarChart3 className="h-3.5 w-3.5" />
                      </button>

                      {/* preview */}
                      <button
                        type="button"
                        onClick={() => {
                          setInspectedItem(item);
                          setInspectorTab("preview");
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-violet-500/70 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20 hover:border-violet-400 transition"
                        title="Preview article"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* footer / pagination */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-800 text-[11px] text-slate-400">
            <span>
              Showing{" "}
              <span className="font-semibold text-slate-100">
                {totalItems}
              </span>{" "}
              item(s) • page{" "}
              <span className="font-semibold text-slate-100">
                {page}
              </span>
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={!canPrev || loading}
                onClick={() =>
                  setOffset((o) => Math.max(0, o - limit))
                }
                className="px-3 py-1 rounded-full border border-slate-700 bg-slate-900 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                disabled={!canNext || loading}
                onClick={() => setOffset((o) => o + limit)}
                className="px-3 py-1 rounded-full border border-slate-700 bg-slate-900 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* MINI ANALYTICS ROW */}
        <div className="grid gap-3 md:grid-cols-3 text-[11px]">
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <div className="text-slate-400 mb-1">Page Snapshot</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-500">
                  Items on page
                </div>
                <div className="text-lg font-semibold text-slate-50">
                  {totalItems}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">
                  Distinct portals
                </div>
                <div className="text-lg font-semibold text-slate-50">
                  {Object.keys(portalStats).length || 0}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <div className="text-slate-400 mb-1">Per-Portal Counts</div>
            {Object.keys(portalStats).length === 0 ? (
              <p className="text-slate-500">
                No data yet. Once articles appear, distribution per portal
                shows here.
              </p>
            ) : (
              <ul className="space-y-0.5 text-slate-300">
                {Object.entries(portalStats).map(([p, count]) => (
                  <li
                    key={p}
                    className="flex items-center justify-between"
                  >
                    <span className="truncate">{p}</span>
                    <span className="font-mono text-slate-100">
                      {count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <div className="text-slate-400 mb-1">Per-Topic Counts</div>
            {Object.keys(topicStats).length === 0 ? (
              <p className="text-slate-500">
                No topic labels yet. When your classifier writes topics to
                DB, they will appear here.
              </p>
            ) : (
              <ul className="space-y-0.5 text-slate-300">
                {Object.entries(topicStats).map(([t, count]) => (
                  <li
                    key={t}
                    className="flex items-center justify-between"
                  >
                    <span className="truncate">{t}</span>
                    <span className="font-mono text-slate-100">
                      {count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* INSPECTOR (PREVIEW + ANALYSIS) */}
      {inspectedItem && (
        <InspectorPanel
          item={inspectedItem}
          tab={inspectorTab}
          onTabChange={setInspectorTab}
          onClose={closeInspector}
        />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   INSPECTOR PANEL
   ────────────────────────────────────────────────────────────── */

function InspectorPanel({ item, tab, onTabChange, onClose }) {
  const stats = computeArticleStats(item);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-end md:items-stretch md:justify-end">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* panel */}
      <div className="relative z-50 w-full md:w-[420px] bg-slate-950 border-l border-slate-800 shadow-2xl flex flex-col max-h-full">
        {/* header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/95">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-sky-500/10 border border-sky-500/60 flex items-center justify-center">
              <Activity className="h-3.5 w-3.5 text-sky-300" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-50">
                Inspect Article
              </div>
              <div className="text-[11px] text-slate-400 truncate max-w-[200px] md:max-w-[240px]">
                {item.title || "(no title)"}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* tabs */}
        <div className="px-4 pt-2 pb-1 border-b border-slate-800 flex items-center gap-2 text-[11px]">
          <button
            type="button"
            onClick={() => onTabChange("preview")}
            className={`px-2.5 py-1 rounded-full border text-xs ${
              tab === "preview"
                ? "border-violet-500 bg-violet-500/15 text-violet-100"
                : "border-transparent bg-slate-900 text-slate-300 hover:bg-slate-900/80"
            }`}
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => onTabChange("analysis")}
            className={`px-2.5 py-1 rounded-full border text-xs ${
              tab === "analysis"
                ? "border-emerald-500 bg-emerald-500/15 text-emerald-100"
                : "border-transparent bg-slate-900 text-slate-300 hover:bg-slate-900/80"
            }`}
          >
            Quick Analysis
          </button>
        </div>

        {/* content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-[12px] text-slate-200">
          {tab === "preview" ? (
            <>
              <div>
                <h3 className="text-sm font-semibold text-slate-50">
                  {item.title || "(no title)"}
                </h3>
                <p className="mt-1 text-[11px] text-slate-400">
                  Portal:{" "}
                  <span className="text-slate-200 font-medium">
                    {item.portal || "unknown"}
                  </span>
                  {item.topic && (
                    <>
                      {" "}
                      • Topic:{" "}
                      <span className="text-amber-200 font-medium">
                        {item.topic}
                      </span>
                    </>
                  )}
                </p>
              </div>

              {item.summary && (
                <div className="border border-slate-800 rounded-lg bg-slate-900/80 p-2">
                  <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Summary
                  </div>
                  <p className="text-[12px] text-slate-200 whitespace-pre-wrap">
                    {item.summary}
                  </p>
                </div>
              )}

              {item.content && (
                <div className="border border-slate-800 rounded-lg bg-slate-900/80 p-2">
                  <div className="text-[11px] font-semibold text-slate-400 mb-1">
                    Full Content
                  </div>
                  <p className="text-[12px] text-slate-200 whitespace-pre-wrap max-h-[260px] overflow-y-auto">
                    {item.content}
                  </p>
                </div>
              )}

              {!item.summary && !item.content && (
                <p className="text-[11px] text-slate-500">
                  No summary/content saved for this article. Open the original
                  article from the list to read it.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="border border-slate-800 rounded-lg bg-slate-900/80 p-2">
                  <div className="text-[10px] text-slate-400">
                    Word Count
                  </div>
                  <div className="text-lg font-semibold text-slate-50">
                    {stats.wordCount}
                  </div>
                </div>
                <div className="border border-slate-800 rounded-lg bg-slate-900/80 p-2">
                  <div className="text-[10px] text-slate-400">
                    Read Time (min)
                  </div>
                  <div className="text-lg font-semibold text-slate-50">
                    {stats.readMinutes}
                  </div>
                </div>
                <div className="border border-slate-800 rounded-lg bg-slate-900/80 p-2">
                  <div className="text-[10px] text-slate-400">
                    Characters
                  </div>
                  <div className="text-lg font-semibold text-slate-50">
                    {stats.charCount}
                  </div>
                </div>
                <div className="border border-slate-800 rounded-lg bg-slate-900/80 p-2">
                  <div className="text-[10px] text-slate-400">
                    Bangladesh Mention
                  </div>
                  <div className="text-sm font-semibold text-slate-50">
                    {stats.mentionsBangladesh ? "Yes" : "No"}
                  </div>
                </div>
              </div>

              <div className="border border-slate-800 rounded-lg bg-slate-900/80 p-2 space-y-1">
                <div className="text-[11px] font-semibold text-slate-400 mb-1">
                  Meta
                </div>
                <div className="text-[11px] text-slate-300">
                  Portal:{" "}
                  <span className="font-medium text-slate-50">
                    {item.portal || "unknown"}
                  </span>
                </div>
                {item.topic && (
                  <div className="text-[11px] text-slate-300">
                    Topic:{" "}
                    <span className="font-medium text-amber-200">
                      {item.topic}
                    </span>
                  </div>
                )}
                {(item.pub_date || item.article_pub_date) && (
                  <div className="text-[11px] text-slate-300">
                    Created:{" "}
                    <span className="font-medium text-slate-50">
                      {prettyDate(
                        item.article_pub_date ||
                          item.pub_date ||
                          item.created_at
                      )}
                    </span>
                  </div>
                )}
                {item.author && (
                  <div className="text-[11px] text-slate-300">
                    Author:{" "}
                    <span className="font-medium text-slate-50">
                      {item.author}
                    </span>
                  </div>
                )}
              </div>

              {(item.sentiment_label ||
                item.sentiment_score != null ||
                item.towards_bangladesh) && (
                <div className="border border-slate-800 rounded-lg bg-slate-900/80 p-2 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-400">
                    Model Sentiment (DB)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {item.sentiment_label && (
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          item.sentiment_label === "positive"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : item.sentiment_label === "negative"
                            ? "bg-rose-500/15 text-rose-300"
                            : item.sentiment_label === "neutral"
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-slate-500/15 text-slate-300"
                        }`}
                      >
                        label: {item.sentiment_label}
                      </span>
                    )}
                    {item.sentiment_score != null && (
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-200 text-[10px] font-medium">
                        score: {item.sentiment_score.toFixed(3)}
                      </span>
                    )}
                    {item.towards_bangladesh && (
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-200 text-[10px] font-medium">
                        towards: {item.towards_bangladesh}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Info(props) {
  // tiny inline icon using lucide style but lighter dependency
  return <Activity {...props} />;
}
