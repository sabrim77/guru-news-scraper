// src/pages/news/ImportNews.jsx

import React, { useState } from "react";
import { apiKeywordFetch } from "../../api";
import {
  Search,
  Globe2,
  SlidersHorizontal,
  Calendar,
  Clock3,
  Loader2,
} from "lucide-react";

const SOURCES = [
  { id: "prothomalo", label: "Prothom Alo", domain: "prothomalo.com" },
  { id: "kalerkantho", label: "Kaler Kantho", domain: "kalerkantho.com" },
  { id: "risingbd", label: "RisingBD", domain: "risingbd.com" },
  { id: "jagonews24", label: "JagoNews24", domain: "jagonews24.com" },
  { id: "bbc", label: "BBC", domain: "bbc.com" },
];

// ---------- helpers for visualization ----------

function computeStats(res) {
  if (!res || !res.by_keyword) return null;

  const sentimentCounts = {
    positive: 0,
    negative: 0,
    neutral: 0,
    unknown: 0,
  };
  const sourceCounts = {};
  let total = 0;
  let hasSentiment = false;

  Object.values(res.by_keyword).forEach((list) => {
    if (!Array.isArray(list)) return;
    list.forEach((item) => {
      total += 1;
      const src = item.source || "unknown";
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;

      const labelRaw =
        item.sentiment_label ||
        item.sentiment ||
        item.sentimentLabel ||
        item.towards_bangladesh ||
        null;

      if (labelRaw) {
        hasSentiment = true;
        const l = String(labelRaw).toLowerCase();
        if (l.includes("pos")) sentimentCounts.positive += 1;
        else if (l.includes("neg")) sentimentCounts.negative += 1;
        else if (l.includes("neutral") || l.includes("neu"))
          sentimentCounts.neutral += 1;
        else sentimentCounts.unknown += 1;
      } else {
        sentimentCounts.unknown += 1;
      }
    });
  });

  const totalArticles =
    typeof res.total_fetched === "number" && res.total_fetched > 0
      ? res.total_fetched
      : total;

  return {
    total: totalArticles,
    sourceCounts,
    sentimentCounts,
    hasSentiment,
  };
}

function flattenArticles(res) {
  if (!res || !res.by_keyword) return [];
  const byKeyword = res.by_keyword;
  const seen = new Set();
  const all = [];

  Object.values(byKeyword).forEach((list) => {
    if (!Array.isArray(list)) return;
    list.forEach((item) => {
      const key = item.url || `${item.title}-${item.source}-${all.length}`;
      if (seen.has(key)) return;
      seen.add(key);
      all.push(item);
    });
  });

  return all;
}

// ------------------------------------------------

export default function ImportNews() {
  // keywords
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState([]);

  // sources
  const [selectedSourceIds, setSelectedSourceIds] = useState(
    SOURCES.map((s) => s.id)
  );

  // time controls (UI only for now)
  // 'latest' | 'range' | 'past'
  const [timeMode, setTimeMode] = useState("latest");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pastDays, setPastDays] = useState(7);

  const [maxPages, setMaxPages] = useState(5);

  // result / error
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [result, setResult] = useState(null);
  const [stats, setStats] = useState(null);

  const articles = result ? flattenArticles(result) : [];

  // helpers
  const addKeyword = () => {
    const k = keywordInput.trim();
    if (!k) return;
    if (!keywords.includes(k)) {
      setKeywords((prev) => [...prev, k]);
    }
    setKeywordInput("");
  };

  const removeKeyword = (kw) => {
    setKeywords((prev) => prev.filter((x) => x !== kw));
  };

  const toggleSource = (id) => {
    setSelectedSourceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllSources = () => {
    setSelectedSourceIds(SOURCES.map((s) => s.id));
  };

  const clearSources = () => {
    setSelectedSourceIds([]);
  };

  const handleImport = async () => {
    const query =
      keywords.length > 0 ? keywords.join(", ") : keywordInput.trim();
    if (!query || selectedSourceIds.length === 0) return;

    setLoading(true);
    setErr(null);
    setResult(null);
    setStats(null);

    try {
      const res = await apiKeywordFetch({ q: query });

      const safeResult = {
        raw_query: res.raw_query ?? query,
        total_fetched:
          typeof res.total_fetched === "number" ? res.total_fetched : 0,
        keywords: Array.isArray(res.keywords) ? res.keywords : [],
        by_keyword:
          typeof res.by_keyword === "object" && res.by_keyword !== null
            ? res.by_keyword
            : {},
      };

      setResult(safeResult);
      setStats(computeStats(safeResult));
    } catch (e) {
      console.error("Keyword import failed:", e);
      setErr(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const totalSelectedSources = selectedSourceIds.length;
  const hasAnyKeyword =
    keywords.length > 0 || keywordInput.trim().length > 0;
  const canImport = hasAnyKeyword && totalSelectedSources > 0 && !loading;

  const summaryTimeLabel =
    timeMode === "latest"
      ? "Latest only"
      : timeMode === "range"
      ? startDate && endDate
        ? `${startDate} → ${endDate}`
        : "Custom range"
      : `Past ${pastDays} day(s)`;

  // KPI numbers
  const totalArticles = stats?.total ?? (result?.total_fetched || 0);
  const distinctSources = stats ? Object.keys(stats.sourceCounts).length : 0;
  const posCount = stats?.sentimentCounts.positive || 0;
  const negCount = stats?.sentimentCounts.negative || 0;
  const neuCount = stats?.sentimentCounts.neutral || 0;
  const sentTotal = stats?.total || 0;
  const posPct =
    sentTotal > 0 ? Math.round((posCount / sentTotal) * 100) : 0;
  const negPct =
    sentTotal > 0 ? Math.round((negCount / sentTotal) * 100) : 0;
  const neuPct =
    sentTotal > 0 ? Math.round((neuCount / sentTotal) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* PAGE HEADER */}
      <div>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-50">
          Import Configuration
        </h1>
        <p className="text-sm text-slate-400">
          Configure your news import settings including keywords, sources, and
          time range.
        </p>
      </div>

      {/* MAIN CONFIG CARD */}
      <section className="bg-slate-950/90 border border-slate-800 rounded-2xl shadow-xl p-4 md:p-6 space-y-5">
        <div className="grid gap-4 lg:grid-cols-3 items-start">
          {/* COLUMN 1 — KEYWORDS */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            {/* header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-sky-500/15 border border-sky-500/40 flex items-center justify-center">
                  <Search className="h-3.5 w-3.5 text-sky-300" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">
                    Keywords to Search
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Saved keywords + ad-hoc terms.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="hidden md:inline-flex items-center gap-1 rounded-full border border-slate-700/80 bg-slate-900/80 px-2 py-1 text-[11px] text-slate-300"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1" />
                Saved Keywords
              </button>
            </div>

            {/* input */}
            <div className="flex gap-2 text-xs">
              <input
                type="text"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500"
                placeholder="Add custom keyword…"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
              />
              <button
                type="button"
                onClick={addKeyword}
                className="px-3 py-2 rounded-lg bg-sky-600 text-xs font-medium text-slate-50 hover:bg-sky-500 disabled:opacity-50"
                disabled={!keywordInput.trim()}
              >
                Add
              </button>
            </div>

            {/* list */}
            <div className="min-h-[90px] rounded-lg border border-dashed border-slate-700/80 bg-slate-950/70 p-2 text-xs text-slate-400 space-y-1">
              {keywords.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  No keywords selected. Type and press{" "}
                  <span className="font-semibold text-slate-300">Add</span>.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((kw) => (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => removeKeyword(kw)}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-1 text-[11px] text-slate-100 border border-slate-600/80 hover:border-red-400/70"
                    >
                      <span>{kw}</span>
                      <span className="text-slate-400 hover:text-red-400">
                        ×
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 2 — SOURCES */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
                  <Globe2 className="h-3.5 w-3.5 text-emerald-300" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">
                    News Sources
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {totalSelectedSources} source
                    {totalSelectedSources !== 1 && "s"} selected.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/80 text-slate-400 text-[11px]"
              >
                <Search className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <button
                type="button"
                className="hover:text-sky-300"
                onClick={selectAllSources}
              >
                Select All
              </button>
              <button
                type="button"
                className="hover:text-slate-200"
                onClick={clearSources}
              >
                Clear
              </button>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
              {SOURCES.map((src) => {
                const selected = selectedSourceIds.includes(src.id);
                return (
                  <label
                    key={src.id}
                    className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs cursor-pointer border ${
                      selected
                        ? "bg-slate-900/90 border-sky-500/70 shadow-[0_0_0_1px_rgba(56,189,248,0.35)]"
                        : "bg-slate-900/70 border-slate-700 hover:border-slate-500"
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-100">
                        {src.label}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {src.domain}
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleSource(src.id)}
                      className="h-3.5 w-3.5 accent-sky-500"
                    />
                  </label>
                );
              })}
            </div>
          </div>

          {/* COLUMN 3 — ADVANCED / TIME */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-amber-300" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">
                    Advanced Settings
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Time window & page limits.
                  </p>
                </div>
              </div>
            </div>

            {/* Time range pills */}
            <div className="space-y-2">
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <Calendar className="h-3 w-3" />
                TIME RANGE
              </span>
              <div className="inline-flex rounded-full bg-slate-900/80 border border-slate-700 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setTimeMode("latest")}
                  className={`px-3 py-1.5 rounded-full ${
                    timeMode === "latest"
                      ? "bg-slate-800 text-slate-50"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Latest
                </button>
                <button
                  type="button"
                  onClick={() => setTimeMode("range")}
                  className={`px-3 py-1.5 rounded-full ${
                    timeMode === "range"
                      ? "bg-slate-800 text-slate-50"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Custom Range
                </button>
                <button
                  type="button"
                  onClick={() => setTimeMode("past")}
                  className={`px-3 py-1.5 rounded-full ${
                    timeMode === "past"
                      ? "bg-slate-800 text-slate-50"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Past X Days
                </button>
              </div>
            </div>

            {/* date inputs */}
            {timeMode === "range" && (
              <div className="grid grid-cols-1 gap-2 text-xs">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>
            )}

            {timeMode === "past" && (
              <div className="space-y-1 text-xs">
                <label className="block text-[11px] text-slate-400 mb-1">
                  Past days
                </label>
                <select
                  value={pastDays}
                  onChange={(e) => setPastDays(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                >
                  <option value={1}>Past 1 day</option>
                  <option value={3}>Past 3 days</option>
                  <option value={7}>Past 7 days</option>
                  <option value={30}>Past 30 days</option>
                  <option value={90}>Past 90 days</option>
                </select>
              </div>
            )}

            {/* max pages */}
            <div className="space-y-1 text-xs">
              <label className="block text-[11px] text-slate-400">
                Max pages per source
              </label>
              <select
                value={maxPages}
                onChange={(e) => setMaxPages(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
              >
                <option value={1}>1 page</option>
                <option value={3}>3 pages</option>
                <option value={5}>5 pages</option>
                <option value={10}>10 pages</option>
              </select>
            </div>

            {/* small summary inside col */}
            <div className="mt-2 text-[11px] text-slate-400 border border-slate-800 rounded-lg p-2 space-y-1">
              <div className="flex justify-between">
                <span>Keywords</span>
                <span className="font-mono text-slate-200">
                  {keywords.length || (keywordInput.trim() ? 1 : 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Sources</span>
                <span className="font-mono text-slate-200">
                  {totalSelectedSources}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Max pages</span>
                <span className="font-mono text-slate-200">
                  {maxPages}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER SUMMARY + CTA */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-4 border-t border-slate-800">
          <div className="text-[11px] text-slate-400 flex flex-wrap gap-3">
            <span className="flex items-center gap-1">
              <Clock3 className="h-3 w-3 text-slate-500" />
              <span>Time:</span>
              <span className="text-slate-200 font-medium">
                {summaryTimeLabel}
              </span>
            </span>
            <span>
              Keywords:{" "}
              <span className="text-slate-200 font-medium">
                {keywords.length || (keywordInput.trim() ? 1 : 0)}
              </span>{" "}
              • Sources:{" "}
              <span className="text-slate-200 font-medium">
                {totalSelectedSources}
              </span>{" "}
              • Max pages:{" "}
              <span className="text-slate-200 font-medium">{maxPages}</span>
            </span>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleImport}
              disabled={!canImport}
              className="inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-medium bg-gradient-to-r from-emerald-500 via-sky-500 to-cyan-400 text-slate-950 hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(56,189,248,0.55)]"
            >
              {loading && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {loading ? "Importing…" : "Import News Articles"}
            </button>
          </div>
        </div>
      </section>

      {/* ERROR */}
      {err && (
        <div className="border border-red-500/40 bg-red-950/60 text-xs text-red-200 px-3 py-2 rounded-lg">
          Error: {err}
        </div>
      )}

      {/* RESULTS + STRUCTURED VISUALIZATIONS */}
      {result && (
        <section className="space-y-5">
          {/* SECTION HEADER */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-sm md:text-base font-semibold tracking-tight text-slate-50">
                Import Overview
              </h2>
              <p className="text-[11px] md:text-xs text-slate-400">
                Summary of the latest import run based on your configuration.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-700/70 bg-slate-950/80 px-2.5 py-1 text-slate-300">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                Query:
                <span className="font-medium text-slate-50">
                  {result.raw_query}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-700/70 bg-slate-950/80 px-2.5 py-1 text-slate-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {totalArticles} article{totalArticles !== 1 && "s"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-700/70 bg-slate-950/80 px-2.5 py-1 text-slate-300">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                {distinctSources} source{distinctSources !== 1 && "s"}
              </span>
            </div>
          </div>

          {/* KPI STRIP */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Articles */}
            <div className="relative overflow-hidden rounded-2xl border border-sky-500/40 bg-gradient-to-br from-sky-500/15 via-slate-950 to-slate-950 px-4 py-3 shadow-[0_0_22px_rgba(56,189,248,0.45)]">
              <p className="text-[11px] uppercase tracking-[0.16em] text-sky-200/80">
                Total Articles
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-50">
                {totalArticles}
              </p>
              <p className="mt-1 text-[11px] text-sky-100/80 line-clamp-1">
                Across all selected sources
              </p>
              <div className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-sky-400/25 blur-xl" />
            </div>

            {/* Distinct Sources */}
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 via-slate-950 to-slate-950 px-4 py-3 shadow-[0_0_22px_rgba(16,185,129,0.45)]">
              <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-200/80">
                Distinct Sources
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-50">
                {distinctSources}
              </p>
              <p className="mt-1 text-[11px] text-emerald-100/80">
                Portals in this batch
              </p>
              <div className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-emerald-400/25 blur-xl" />
            </div>

            {/* Positive vs Negative */}
            <div className="relative overflow-hidden rounded-2xl border border-indigo-500/40 bg-gradient-to-br from-indigo-500/15 via-slate-950 to-slate-950 px-4 py-3 shadow-[0_0_22px_rgba(129,140,248,0.45)]">
              <p className="text-[11px] uppercase tracking-[0.16em] text-indigo-200/80">
                Positive vs Negative
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-50">
                {posPct}%{" "}
                <span className="text-[11px] font-normal text-slate-300">
                  positive
                </span>
              </p>
              <p className="text-[11px] text-slate-400">
                Negative:{" "}
                <span className="text-rose-300 font-medium">
                  {negPct}%
                </span>
              </p>
              <div className="pointer-events-none absolute -right-8 -bottom-8 h-16 w-16 rounded-full bg-indigo-400/25 blur-xl" />
            </div>

            {/* Neutral Coverage */}
            <div className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-slate-950 to-slate-950 px-4 py-3 shadow-[0_0_22px_rgba(245,158,11,0.45)]">
              <p className="text-[11px] uppercase tracking-[0.16em] text-amber-200/80">
                Neutral Coverage
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-50">
                {neuPct}%
              </p>
              <p className="mt-1 text-[11px] text-amber-100/80">
                Of all articles with sentiment
              </p>
              <div className="pointer-events-none absolute -right-7 -top-5 h-14 w-14 rounded-full bg-amber-400/25 blur-xl" />
            </div>
          </div>

          {/* MAIN ANALYTICS GRID: LEFT (analytics), RIGHT (feed) */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* LEFT COLUMN: Sentiment + Sources stacked */}
            <div className="space-y-4 lg:col-span-1">
              {/* SENTIMENT CARD */}
              <div className="border border-slate-800 bg-slate-950/95 rounded-2xl p-4 space-y-3 shadow-[0_0_24px_rgba(15,23,42,0.9)]">
                <h2 className="text-sm font-semibold text-slate-100">
                  Sentiment Snapshot
                </h2>
                <p className="text-[11px] text-slate-400">
                  Distribution across all scraped articles with sentiment.
                </p>

                {stats && stats.hasSentiment ? (
                  <div className="space-y-3">
                    {/* stacked bar */}
                    <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden flex">
                      {sentTotal > 0 && (
                        <>
                          <div
                            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                            style={{ width: `${posPct}%` }}
                          />
                          <div
                            className="h-full bg-gradient-to-r from-slate-400 to-slate-300"
                            style={{ width: `${neuPct}%` }}
                          />
                          <div
                            className="h-full bg-gradient-to-r from-rose-500 to-red-500"
                            style={{ width: `${negPct}%` }}
                          />
                        </>
                      )}
                    </div>

                    {/* legend pills */}
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/90 border border-emerald-500/40 px-2 py-0.5 text-emerald-200">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        Positive {posPct}%
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/90 border border-slate-500/50 px-2 py-0.5 text-slate-200">
                        <span className="h-2 w-2 rounded-full bg-slate-300" />
                        Neutral {neuPct}%
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/90 border border-rose-500/60 px-2 py-0.5 text-rose-200">
                        <span className="h-2 w-2 rounded-full bg-rose-400" />
                        Negative {negPct}%
                      </span>
                    </div>

                    {/* raw counts */}
                    <div className="grid grid-cols-3 gap-2 text-[11px] pt-2 border-t border-slate-800">
                      <div className="space-y-0.5">
                        <p className="text-slate-400">Positive</p>
                        <p className="font-mono text-emerald-300">
                          {posCount}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-slate-400">Neutral</p>
                        <p className="font-mono text-slate-200">
                          {neuCount}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-slate-400">Negative</p>
                        <p className="font-mono text-rose-300">
                          {negCount}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    No sentiment columns detected in this response. Once your
                    backend includes{" "}
                    <code className="font-mono text-[10px] text-slate-300">
                      sentiment_label
                    </code>{" "}
                    (or similar), this panel will auto-populate.
                  </p>
                )}
              </div>

              {/* SOURCES CARD */}
              <div className="border border-slate-800 bg-slate-950/95 rounded-2xl p-4 space-y-3 shadow-[0_0_24px_rgba(15,23,42,0.9)]">
                <h2 className="text-sm font-semibold text-slate-100">
                  Source Breakdown
                </h2>
                <p className="text-[11px] text-slate-400">
                  Top portals contributing to this batch.
                </p>

                {stats && Object.keys(stats.sourceCounts).length > 0 ? (
                  <div className="space-y-2 text-xs">
                    {Object.entries(stats.sourceCounts)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 6)
                      .map(([src, count]) => {
                        const total = stats.total || 1;
                        const pct = Math.round((count / total) * 100);
                        return (
                          <div key={src} className="space-y-0.5">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-200">{src}</span>
                              <span className="text-slate-400">
                                {count} · {pct}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-sky-500 via-emerald-400 to-cyan-300"
                                style={{
                                  width: `${Math.min(pct, 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    No per-source breakdown available.
                  </p>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: SCROLLING SCRAPED FEED */}
            <div className="lg:col-span-2 border border-slate-800 bg-slate-950/95 rounded-2xl p-4 space-y-3 shadow-[0_0_24px_rgba(15,23,42,0.9)]">
              <h2 className="text-sm font-semibold text-slate-100">
                Scraped News Feed
              </h2>
              <p className="text-[11px] text-slate-400">
                Latest batch across all keywords. Scroll to explore.
              </p>

              <div className="max-h-[420px] overflow-y-auto pr-1 space-y-2">
                {articles.length === 0 ? (
                  <p className="text-[11px] text-slate-500">
                    No article details available in this response.
                  </p>
                ) : (
                  articles.map((item, idx) => (
                    <article
                      key={item.url || idx}
                      className="border border-slate-800/70 rounded-xl px-3 py-2 text-xs bg-slate-900/70 hover:border-sky-500/60 hover:bg-slate-900/90 transition-colors"
                    >
                      <div className="flex justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-slate-50 text-[13px] line-clamp-2">
                            {item.title || "(no title)"}
                          </h3>
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                            {item.summary ||
                              item.description ||
                              "(no summary)"}
                          </p>
                        </div>
                        <span className="text-[10px] text-slate-500 whitespace-nowrap text-right">
                          {item.source || "unknown"}
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between items-center text-[11px] text-slate-400">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-400 hover:underline"
                        >
                          Open article ↗
                        </a>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
