// src/pages/news/ImportNews.jsx

import React, { useState } from "react";
import { apiKeywordFetch } from "../../api";

const SOURCES = [
  { id: "prothomalo", label: "Prothom Alo", domain: "prothomalo.com" },
  { id: "kalerkantho", label: "Kaler Kantho", domain: "kalerkantho.com" },
  { id: "risingbd", label: "RisingBD", domain: "risingbd.com" },
  { id: "jagonews24", label: "JagoNews24", domain: "jagonews24.com" },
  { id: "bbc", label: "BBC", domain: "bbc.com" },
];

export default function ImportNews() {
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState(
    SOURCES.map((s) => s.id)
  );

  const [timeRange, setTimeRange] = useState("latest"); // 'latest' | 'custom'
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [maxPages, setMaxPages] = useState(5);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [result, setResult] = useState(null);

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

  const handleImport = async () => {
    const hasInputKeyword = keywordInput.trim().length > 0;
    const hasKeywords = keywords.length > 0 || hasInputKeyword;
    const hasSources = selectedSourceIds.length > 0;

    if (!hasKeywords || !hasSources) return;

    const query =
      keywords.length > 0 ? keywords.join(", ") : keywordInput.trim();

    setLoading(true);
    setErr(null);
    setResult(null);

    try {
      // Backend currently uses only q/lang/country.
      // apiKeywordFetch will throw if q is empty.
      const res = await apiKeywordFetch({
        q: query,
        // If later you support portal filters/max_pages in backend,
        // you can add them here as extra query params.
      });

      // Be defensive about shape
      const safeResult = {
        raw_query: res.raw_query ?? query,
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

      setResult(safeResult);
    } catch (e) {
      console.error("Keyword import failed:", e);
      setErr(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const totalSelectedSources = selectedSourceIds.length;
  const hasAnyKeyword = keywords.length > 0 || keywordInput.trim().length > 0;
  const canImport = hasAnyKeyword && totalSelectedSources > 0 && !loading;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Import Configuration
        </h1>
        <p className="text-sm text-slate-400">
          Configure keyword-based imports from your news portals. This calls the
          backend keyword fetch API and writes to SQLite.
        </p>
      </div>

      <section className="bg-slate-950/80 border border-slate-800 rounded-2xl shadow-lg p-4 md:p-6 space-y-4">
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Keywords column */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />
              Keywords to Search
            </h2>
            <p className="text-xs text-slate-400">
              Add one or more keywords / phrases. Comma-separated will also be
              supported when sending to backend.
            </p>

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

            <div className="min-h-[80px] rounded-lg border border-dashed border-slate-700/80 bg-slate-950/60 p-2 text-xs text-slate-400 space-y-1">
              {keywords.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  No keywords selected. Type and press{" "}
                  <span className="font-semibold">Add</span>.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((kw) => (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => removeKeyword(kw)}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-1 text-[11px] text-slate-100"
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

          {/* Sources column */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              News Sources
            </h2>
            <p className="text-xs text-slate-400">
              Select which portals to target for this import batch.
            </p>

            <p className="text-[11px] text-slate-400">
              {totalSelectedSources} source(s) selected
            </p>

            <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
              {SOURCES.map((src) => {
                const selected = selectedSourceIds.includes(src.id);
                return (
                  <label
                    key={src.id}
                    className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs cursor-pointer border ${
                      selected
                        ? "bg-slate-800/90 border-sky-500/60"
                        : "bg-slate-900 border-slate-700 hover:border-slate-500"
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

          {/* Advanced settings column */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
              Advanced Settings
            </h2>

            <div className="space-y-2 text-xs">
              <label className="block text-[11px] text-slate-400">
                Time Range
              </label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
              >
                <option value="latest">Latest (no date filter yet)</option>
                <option value="custom">Custom Range (UI only)</option>
              </select>
            </div>

            {timeRange === "custom" && (
              <div className="grid grid-cols-1 gap-2 text-xs">
                <div>
                  <label className="block text-[11px] text-slate-400">
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
                  <label className="block text-[11px] text-slate-400">
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

            <div className="space-y-2 text-xs">
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

            <div className="mt-2 text-[11px] text-slate-500 border border-slate-800 rounded-lg p-2">
              <div className="flex justify-between">
                <span>Summary</span>
                <span className="font-mono text-slate-300">
                  kw: {keywords.length || (keywordInput.trim() ? 1 : 0)} • src:{" "}
                  {totalSelectedSources} • pages: {maxPages}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleImport}
            disabled={!canImport}
            className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium bg-emerald-600 text-slate-50 hover:bg-emerald-500 disabled:opacity-60"
          >
            {loading ? "Importing…" : "Import News Articles"}
          </button>
        </div>
      </section>

      {/* Error / results */}
      {err && (
        <div className="border border-red-500/40 bg-red-950/60 text-xs text-red-200 px-3 py-2 rounded-lg">
          Error: {err}
        </div>
      )}

      {result && (
        <section className="border border-slate-800 bg-slate-950/80 rounded-2xl p-4 space-y-3">
          <p className="text-xs text-slate-300">
            Imported using query{" "}
            <span className="font-semibold text-slate-50">
              {result.raw_query}
            </span>
            . Total fetched:{" "}
            <span className="font-semibold">{result.total_fetched}</span>
          </p>

          {Array.isArray(result.keywords) && result.keywords.length > 0 ? (
            result.keywords.map((kw) => {
              const byKeyword = result.by_keyword || {};
              const list = Array.isArray(byKeyword[kw]) ? byKeyword[kw] : [];

              return (
                <div key={kw} className="space-y-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-200 text-[11px] font-medium">
                    keyword: {kw} · {list.length} article(s)
                  </span>
                  <div className="space-y-2">
                    {list.map((item, idx) => (
                      <article
                        key={`${item.url}-${idx}`}
                        className="border border-slate-800 rounded-lg px-3 py-2 text-xs bg-slate-900/60"
                      >
                        <div className="flex justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-slate-50 text-[13px]">
                              {item.title || "(no title)"}
                            </h3>
                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                              {item.summary || "(no summary)"}
                            </p>
                          </div>
                          <span className="text-[10px] text-slate-500 whitespace-nowrap">
                            {item.source}
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
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-[11px] text-slate-400">
              No results returned from backend for this query.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
