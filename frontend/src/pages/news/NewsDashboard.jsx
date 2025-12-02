// src/pages/news/NewsDashboard.jsx

import React, { useEffect, useState } from "react";
import { apiLatestNews, apiSentimentOverview } from "../../api";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  AreaChart,
  Area,
} from "recharts";

const COLORS = ["#0AFF9D", "#FF3366", "#FFD447", "#7A89A1"]; // neon, cyber look

export default function NewsDashboard() {
  const [sentiment, setSentiment] = useState(null);
  const [latestNews, setLatestNews] = useState([]);
  const [loadingSentiment, setLoadingSentiment] = useState(true);
  const [loadingNews, setLoadingNews] = useState(true);
  const [errorSentiment, setErrorSentiment] = useState(null);
  const [errorNews, setErrorNews] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // simple client-side portal filter (makes dashboard "adjustable")
  const [selectedPortal, setSelectedPortal] = useState("all");

  // Auto-refresh every 60 sec
  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 60000);
    return () => clearInterval(interval);
  }, []);

  async function fetchAll() {
    fetchSentiment();
    fetchNews();
    setLastUpdated(new Date().toLocaleTimeString());
  }

  async function fetchSentiment() {
    try {
      setLoadingSentiment(true);
      const data = await apiSentimentOverview({ limit: 200 });
      setSentiment(data);
      setErrorSentiment(null);
    } catch (err) {
      setErrorSentiment(err.message || "Failed to load sentiment");
    } finally {
      setLoadingSentiment(false);
    }
  }

  async function fetchNews() {
    try {
      setLoadingNews(true);
      const data = await apiLatestNews({ limit: 50, offset: 0 }); // more items for better viz
      setLatestNews(data.items || []);
      setErrorNews(null);
    } catch (err) {
      setErrorNews(err.message || "Failed to load latest news");
    } finally {
      setLoadingNews(false);
    }
  }

  // ---------------------------------------------------------------
  // DERIVED DATA
  // ---------------------------------------------------------------

  const pieData = sentiment
    ? [
        { name: "Positive", value: sentiment.positive },
        { name: "Negative", value: sentiment.negative },
        { name: "Neutral", value: sentiment.neutral },
        { name: "Unknown", value: sentiment.unknown },
      ]
    : [];

  // all portals for filter dropdown
  const portalsList = Array.from(
    new Set(latestNews.map((n) => n.portal).filter(Boolean))
  ).sort();

  // news used for visualizations (respect portal filter)
  const newsForViz =
    selectedPortal === "all"
      ? latestNews
      : latestNews.filter((n) => n.portal === selectedPortal);

  const distinctPortals = new Set(newsForViz.map((n) => n.portal)).size || 0;
  const distinctTopics = new Set(
    newsForViz.filter((n) => n.topic).map((n) => n.topic)
  ).size;

  const trendData = sentiment?.timeline || null;

  // Articles by portal
  const portalCountsMap = newsForViz.reduce((acc, item) => {
    if (!item.portal) return acc;
    acc[item.portal] = (acc[item.portal] || 0) + 1;
    return acc;
  }, {});
  const portalCountsData = Object.entries(portalCountsMap)
    .map(([portal, count]) => ({ portal, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Topic frequency dataset
  const topicCountsMap = newsForViz.reduce((acc, item) => {
    if (!item.topic) return acc;
    acc[item.topic] = (acc[item.topic] || 0) + 1;
    return acc;
  }, {});
  const topicCountsData = Object.entries(topicCountsMap)
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Time-of-day posting pattern (0-23 hours)
  const hourCounts = new Array(24).fill(0);
  newsForViz.forEach((item) => {
    const dateStr = item.pub_date || item.article_pub_date;
    if (!dateStr) return;
    const d = new Date(dateStr);
    const hour = d.getHours();
    if (!isNaN(hour)) hourCounts[hour]++;
  });
  const hourData = hourCounts.map((count, hour) => ({
    hour: `${hour}:00`,
    count,
  }));

  // Heatmap-like source: sentiment count per portal
  const heatmapRaw = newsForViz.reduce((acc, item) => {
    const portal = item.portal;
    const s = item.sentiment_label || "unknown";
    if (!portal) return acc;

    if (!acc[portal]) {
      acc[portal] = { positive: 0, negative: 0, neutral: 0, unknown: 0 };
    }
    if (!acc[portal][s]) acc[portal][s] = 0;
    acc[portal][s] += 1;
    return acc;
  }, {});
  const heatmapData = Object.entries(heatmapRaw).map(([portal, counts]) => ({
    portal,
    positive: counts.positive || 0,
    negative: counts.negative || 0,
    neutral: counts.neutral || 0,
    unknown: counts.unknown || 0,
  }));

  // Convert portal × sentiment into curve-friendly series (percentage per portal)
  const portalSentimentCurves = heatmapData
    .map((row) => {
      const total =
        row.positive + row.negative + row.neutral + row.unknown || 1;
      return {
        portal: row.portal,
        positive_pct: +( (row.positive / total) * 100 ).toFixed(1),
        negative_pct: +( (row.negative / total) * 100 ).toFixed(1),
        neutral_pct: +( (row.neutral / total) * 100 ).toFixed(1),
        unknown_pct: +( (row.unknown / total) * 100 ).toFixed(1),
      };
    })
    .sort((a, b) => b.negative_pct - a.negative_pct) // most negative portals first
    .slice(0, 10); // limit to top 10 for readability

  // ---------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------

  return (
    <div className="relative z-10">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-cyan-300 tracking-tight drop-shadow-[0_0_10px_rgba(0,255,255,0.35)]">
            Bangladesh News Sentiment
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time analytics over scraped Bangladeshi news portals.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 justify-end">
          {/* SYSTEM STATUS */}
          <div
            className={`px-3 py-1 rounded-full text-xs font-medium border ${
              errorNews || errorSentiment
                ? "border-rose-500/40 text-rose-300 bg-rose-500/10"
                : "border-emerald-500/30 text-emerald-300 bg-emerald-500/10"
            }`}
          >
            {errorNews || errorSentiment ? "System Issues" : "System Stable"}
          </div>

          {/* Last updated */}
          {lastUpdated && (
            <span className="text-xs text-slate-400">
              Updated: <span className="font-medium">{lastUpdated}</span>
            </span>
          )}

          <button
            onClick={fetchAll}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-500/10 hover:shadow-[0_0_10px_rgba(34,211,238,0.4)] transition"
          >
            <span className="inline-block w-2 h-2 rounded-full bg-cyan-300 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            Refresh
          </button>
        </div>
      </header>

      {/* HOLOGRAPHIC HEADER LINE */}
      <div className="w-full h-[2px] bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 opacity-30 rounded-full mb-4" />

      {/* KPI ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4 mb-4">
        <NeonKPI label="Scraped" value={sentiment?.total} glowColor="cyan" />
        <NeonKPI
          label="Positive %"
          value={
            sentiment?.positive_pct != null ? `${sentiment.positive_pct}%` : "—"
          }
          glowColor="emerald"
        />
        <NeonKPI
          label="Negative %"
          value={
            sentiment?.negative_pct != null ? `${sentiment.negative_pct}%` : "—"
          }
          glowColor="rose"
        />
        <NeonKPI label="Portals" value={distinctPortals} glowColor="sky" />
        <NeonKPI label="Topics" value={distinctTopics} glowColor="violet" />
      </div>

      {/* FILTER STRIP */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <span className="text-xs font-semibold tracking-wide uppercase text-slate-500">
          Filters
        </span>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">Portal</span>
          <select
            value={selectedPortal}
            onChange={(e) => setSelectedPortal(e.target.value)}
            className="text-xs rounded-lg border border-slate-700 bg-slate-950/90 px-2 py-1 text-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/70 focus:border-cyan-500"
          >
            <option value="all">All portals</option>
            {portalsList.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <p className="text-[11px] text-slate-500">
          {selectedPortal === "all" ? (
            <>Viewing all available sources.</>
          ) : (
            <>
              Focused on{" "}
              <span className="text-cyan-300 font-medium">
                {selectedPortal}
              </span>{" "}
              only.
            </>
          )}{" "}
          Articles in view:{" "}
          <span className="text-slate-200 font-medium">
            {newsForViz.length}
          </span>
        </p>
      </div>

      {/* MAIN GRID — SENTIMENT, PORTALS, NEWS STREAM */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
        {/* LEFT: SENTIMENT PANEL */}
        <NeonPanel
          title="Sentiment Overview"
          badge={sentiment?.total && `Analyzed: ${sentiment.total}`}
        >
          {loadingSentiment ? (
            <SentimentSkeleton />
          ) : errorSentiment ? (
            <ErrorBanner message={errorSentiment} />
          ) : sentiment ? (
            <>
              {/* Pie Chart */}
              <div className="w-full h-64 mb-5 rounded-2xl p-3 bg-slate-950/80 border border-slate-800 shadow-sm">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={`c-${i}`} fill={COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#020617",
                        border: "1px solid #1f2937",
                        borderRadius: "0.5rem",
                        color: "#e5e7eb",
                        fontSize: "0.8rem",
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "0.75rem", color: "#9ca3af" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* STATS GRID */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <SmallNeonStat
                  label="Positive"
                  value={
                    sentiment.positive_pct != null
                      ? `${sentiment.positive_pct}%`
                      : "—"
                  }
                  color="emerald"
                />
                <SmallNeonStat
                  label="Negative"
                  value={
                    sentiment.negative_pct != null
                      ? `${sentiment.negative_pct}%`
                      : "—"
                  }
                  color="rose"
                />
                <SmallNeonStat
                  label="Neutral"
                  value={
                    sentiment.neutral_pct != null
                      ? `${sentiment.neutral_pct}%`
                      : "—"
                  }
                  color="amber"
                />
                <SmallNeonStat
                  label="Unknown"
                  value={
                    sentiment.unknown_pct != null
                      ? `${sentiment.unknown_pct}%`
                      : "—"
                  }
                  color="slate"
                />
              </div>

              {/* Trend (Line) */}
              {trendData && trendData.length > 0 ? (
                <div>
                  <h3 className="text-xs uppercase tracking-wide text-cyan-300 mb-1">
                    Trend (Recent)
                  </h3>
                  <div className="w-full h-36 bg-slate-950/80 rounded-xl border border-slate-800 p-2">
                    <ResponsiveContainer>
                      <LineChart data={trendData}>
                        <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                        <XAxis
                          dataKey="bucket"
                          tick={{ fontSize: 10, fill: "#9ca3af" }}
                        />
                        <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="positive"
                          stroke="#00FFA2"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="negative"
                          stroke="#FF2E6E"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="neutral"
                          stroke="#FFD447"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">
                  Trend data not available.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-400">No sentiment data.</p>
          )}
        </NeonPanel>

        {/* MIDDLE: ARTICLES BY PORTAL */}
        <NeonPanel
          title="Articles by Portal"
          subtitle="Top sources in the latest visible window"
        >
          {portalCountsData.length === 0 ? (
            <p className="text-sm text-slate-400">
              Not enough data to display portal distribution.
            </p>
          ) : (
            <div className="w-full h-72 bg-slate-950/80 rounded-2xl border border-slate-800 p-3">
              <ResponsiveContainer>
                <BarChart data={portalCountsData} layout="vertical">
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="portal"
                    width={90}
                    tick={{ fontSize: 11, fill: "#e5e7eb" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#020617",
                      border: "1px solid #1f2937",
                      borderRadius: "0.5rem",
                      color: "#e5e7eb",
                      fontSize: "0.8rem",
                    }}
                  />
                  <Bar dataKey="count" fill="#22d3ee" radius={[4, 4, 4, 4]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </NeonPanel>

        {/* RIGHT: NEWS STREAM */}
        <NeonPanel
          title="Latest News Stream"
          subtitle="Live feed from filtered portals"
        >
          {loadingNews ? (
            <NewsListSkeleton />
          ) : errorNews ? (
            <ErrorBanner message={errorNews} />
          ) : newsForViz.length === 0 ? (
            <p className="text-sm text-slate-400">
              No news available for the current filter.
            </p>
          ) : (
            <>
              <p className="text-[11px] text-slate-500 mb-2">
                Showing{" "}
                <span className="text-slate-200 font-medium">
                  {newsForViz.length}
                </span>{" "}
                article{newsForViz.length !== 1 && "s"}
                {selectedPortal !== "all" && (
                  <>
                    {" "}
                    from{" "}
                    <span className="text-cyan-300 font-medium">
                      {selectedPortal}
                    </span>
                  </>
                )}
                .
              </p>
              <div className="space-y-3 overflow-y-auto max-h-[64vh] pr-2 custom-scrollbar">
                {newsForViz.map((n) => (
                  <NeonNewsCard key={n.id} item={n} />
                ))}
              </div>
            </>
          )}
        </NeonPanel>
      </div>

      {/* ROW — ADVANCED VISUALIZATIONS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mt-4">
        {/* SENTIMENT AREA TREND (STACKED) */}
        <NeonPanel
          title="Sentiment Dynamics"
          subtitle="How sentiment shifts across recent scrapes"
        >
          {trendData && trendData.length > 0 ? (
            <div className="w-full h-64 bg-slate-950/80 rounded-2xl border border-slate-800 p-3">
              <ResponsiveContainer>
                <AreaChart data={trendData}>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="bucket"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                  />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="positive"
                    stackId="1"
                    stroke="#00FFA2"
                    fill="#00FFA255"
                  />
                  <Area
                    type="monotone"
                    dataKey="negative"
                    stackId="1"
                    stroke="#FF2E6E"
                    fill="#FF2E6E55"
                  />
                  <Area
                    type="monotone"
                    dataKey="neutral"
                    stackId="1"
                    stroke="#FFD447"
                    fill="#FFD44755"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Not enough trend data to show dynamics.
            </p>
          )}
        </NeonPanel>

        {/* TOPICS BY FREQUENCY */}
        <NeonPanel
          title="Trending Topics"
          subtitle="Top topics in the visible article set"
        >
          {topicCountsData.length === 0 ? (
            <p className="text-sm text-slate-400">
              No topics detected in the current batch.
            </p>
          ) : (
            <div className="w-full h-64 bg-slate-950/80 rounded-2xl border border-slate-800 p-3">
              <ResponsiveContainer>
                <BarChart data={topicCountsData} layout="vertical">
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis
                    dataKey="topic"
                    type="category"
                    width={110}
                    tick={{ fontSize: 11, fill: "#e5e7eb" }}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill="#38bdf8" radius={[4, 4, 4, 4]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </NeonPanel>

        {/* TIME-OF-DAY PUBLISH PATTERN */}
        <NeonPanel
          title="Publishing Pattern"
          subtitle="When portals publish the most articles"
        >
          <div className="w-full h-64 bg-slate-950/80 rounded-2xl border border-slate-800 p-3">
            <ResponsiveContainer>
              <BarChart data={hourData}>
                <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 9, fill: "#9ca3af" }}
                  interval={1}
                />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                <Tooltip />
                <Bar dataKey="count" fill="#22d3ee" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </NeonPanel>
      </div>

      {/* PORTAL × SENTIMENT CURVES (replaces table heatmap) */}
      <div className="mt-4">
        <NeonPanel
          title="Portal Sentiment Curves"
          subtitle="Per-portal sentiment mix (percentage) across sources"
        >
          {portalSentimentCurves.length === 0 ? (
            <p className="text-sm text-slate-400">
              Not enough labeled sentiment data per portal yet.
            </p>
          ) : (
            <div className="w-full h-72 bg-slate-950/80 rounded-2xl border border-slate-800 p-3">
              <ResponsiveContainer>
                <LineChart data={portalSentimentCurves}>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="portal"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#020617",
                      border: "1px solid #1f2937",
                      borderRadius: "0.5rem",
                      color: "#e5e7eb",
                      fontSize: "0.8rem",
                    }}
                    formatter={(value) => [`${value}%`, ""]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "0.75rem", color: "#9ca3af" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="positive_pct"
                    name="Positive %"
                    stroke="#00FFA2"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="negative_pct"
                    name="Negative %"
                    stroke="#FF2E6E"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="neutral_pct"
                    name="Neutral %"
                    stroke="#FFD447"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="unknown_pct"
                    name="Unknown %"
                    stroke="#7A89A1"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </NeonPanel>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   NEON COMPONENTS
   ────────────────────────────────────────────────────────────── */

function NeonKPI({ label, value, glowColor }) {
  const glowMap = {
    cyan: "from-cyan-400 to-blue-500",
    emerald: "from-emerald-400 to-cyan-500",
    rose: "from-rose-500 to-purple-500",
    sky: "from-sky-400 to-blue-600",
    violet: "from-violet-400 to-fuchsia-500",
  };

  return (
    <div className="relative bg-slate-950/80 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm shadow-md hover:border-cyan-500/40 transition-colors">
      {/* Glow Bar */}
      <div
        className={`absolute left-0 top-0 h-full w-[4px] rounded-l-2xl bg-gradient-to-b ${
          glowMap[glowColor]
        } opacity-80`}
      />

      <span className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <h3 className="text-2xl font-semibold text-slate-50 mt-1">
        {value ?? "—"}
      </h3>
    </div>
  );
}

function NeonPanel({ title, subtitle, badge, children }) {
  return (
    <section className="relative bg-slate-950/85 border border-slate-800 rounded-2xl shadow-lg p-5 md:p-6 backdrop-blur-sm hover:border-cyan-500/40 transition-colors">
      {/* Neon corner brackets */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-cyan-400/60 rounded-tl-lg" />
        <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-cyan-400/60 rounded-tr-lg" />
        <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-cyan-400/60 rounded-bl-lg" />
        <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-cyan-400/60 rounded-br-lg" />
      </div>

      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h2 className="text-base md:text-lg font-semibold text-cyan-300">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
          )}
        </div>
        {badge && (
          <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 whitespace-nowrap">
            {badge}
          </span>
        )}
      </div>

      {children}
    </section>
  );
}

function SmallNeonStat({ label, value, color }) {
  const map = {
    emerald: "bg-emerald-400",
    rose: "bg-rose-500",
    amber: "bg-amber-400",
    slate: "bg-slate-500",
  };

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between shadow-sm">
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-xl font-semibold text-slate-50 mt-1">{value}</p>
      </div>
      <span
        className={`inline-flex w-8 h-8 rounded-full ${map[color]} bg-opacity-90`}
      />
    </div>
  );
}

function NeonNewsCard({ item }) {
  const dateText = item.pub_date || item.article_pub_date || "—";

  return (
    <article className="group border border-slate-800 rounded-xl p-4 bg-slate-950/80 hover:bg-slate-900 hover:border-cyan-500/40 hover:shadow-[0_0_15px_rgba(34,211,238,0.25)] transition relative">
      {/* Left Neon Strip */}
      <div className="absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-cyan-400 to-blue-500 opacity-80 rounded-l-xl" />

      <h3 className="text-sm font-semibold text-slate-100 mb-1 group-hover:text-cyan-300 transition">
        {item.title}
      </h3>

      {item.summary && (
        <p className="text-xs text-slate-300 mb-2 line-clamp-2">
          {item.summary}
        </p>
      )}

      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 pt-1 border-t border-slate-800/80">
        <span>{dateText}</span>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-300 hover:text-cyan-200 hover:underline"
        >
          Read ↗
        </a>
      </div>
    </article>
  );
}

function ErrorBanner({ message }) {
  return (
    <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-200 text-xs px-3 py-2">
      <span className="font-semibold mr-1">Error:</span>
      {message}
    </div>
  );
}

function SentimentSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="w-full h-64 mb-4 flex items-center justify-center">
        <div className="w-40 h-40 rounded-full bg-slate-800" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-slate-950/80 border border-slate-800 rounded-xl p-3"
          >
            <div className="h-3 w-16 bg-slate-800 rounded mb-2" />
            <div className="h-6 w-10 bg-slate-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function NewsListSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="border border-slate-800 rounded-xl p-4 bg-slate-950/80"
        >
          <div className="h-4 w-20 bg-slate-800 rounded-full mb-2" />
          <div className="h-4 w-3/4 bg-slate-800 rounded mb-2" />
          <div className="h-3 w-full bg-slate-800 rounded mb-1" />
          <div className="h-3 w-5/6 bg-slate-800 rounded" />
        </div>
      ))}
    </div>
  );
}
