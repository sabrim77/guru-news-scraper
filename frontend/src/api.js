// src/api.js

// Base URL: from Vite env or fallback to local FastAPI
const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(
    /\/+$/,
    ""
  );

/**
 * Small helper to throw on HTTP errors and parse JSON.
 */
async function handleResponse(res) {
  if (!res.ok) {
    let text = "";
    try {
      text = await res.text();
    } catch (_) {}
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

/**
 * Generic GET helper with query params.
 */
async function get(path, params) {
  const search = new URLSearchParams();

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        search.append(key, String(value));
      }
    }
  }

  const qs = search.toString();
  const url = qs ? `${API_BASE_URL}${path}?${qs}` : `${API_BASE_URL}${path}`;

  const res = await fetch(url);
  return handleResponse(res);
}

/**
 * Generic POST helper with JSON body.
 */
async function post(path, body) {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return handleResponse(res);
}

// -------------------------------------------------------------
// HEALTH
// -------------------------------------------------------------

export async function apiHealth() {
  return get("/api/v1/health");
}

// -------------------------------------------------------------
// LATEST NEWS
// -------------------------------------------------------------

export async function apiLatestNews({ limit = 10, offset = 0, portal } = {}) {
  return get("/api/v1/news/latest", { limit, offset, portal });
}

// -------------------------------------------------------------
// NEWS BY TOPIC
// -------------------------------------------------------------

export async function apiNewsByTopic({
  topic,
  limit = 10,
  offset = 0,
  portal,
} = {}) {
  if (!topic) throw new Error("topic is required for apiNewsByTopic");
  return get("/api/v1/news/by_topic", { topic, limit, offset, portal });
}

// -------------------------------------------------------------
// KEYWORD FETCH
// -------------------------------------------------------------

export async function apiKeywordFetch({ q, lang, country } = {}) {
  const query = (q || "").trim();
  if (!query) throw new Error("q (keyword query) is required");
  return get("/api/v1/news/search", { q: query, lang, country });
}

// -------------------------------------------------------------
// ARTICLE BY URL
// -------------------------------------------------------------

export async function apiNewsByUrl(url) {
  if (!url) throw new Error("url is required for apiNewsByUrl");
  return get("/api/v1/news/by_url", { url });
}

// -------------------------------------------------------------
// SENTIMENT: arbitrary text
// -------------------------------------------------------------

export async function apiAnalyzeSentimentText(text) {
  const t = (text || "").trim();
  if (!t) throw new Error("text is required for apiAnalyzeSentimentText");
  return post("/api/v1/analyze/sentiment_text", { text: t });
}

// -------------------------------------------------------------
// SENTIMENT: article by URL
// -------------------------------------------------------------

export async function apiNewsSentimentByUrl(url) {
  if (!url) throw new Error("url is required for apiNewsSentimentByUrl");
  return get("/api/v1/news/sentiment_by_url", { url });
}

// -------------------------------------------------------------
// 🔥 NEW — SENTIMENT OVERVIEW FOR DASHBOARD
// GET /api/v1/analytics/bd_sentiment_overview
// -------------------------------------------------------------

/**
 * Fetch overall Bangladesh sentiment summary for dashboard.
 *
 * Response:
 * {
 *   total: number,
 *   positive: number,
 *   negative: number,
 *   neutral: number,
 *   unknown: number,
 *   positive_pct: number,
 *   negative_pct: number,
 *   neutral_pct: number,
 *   unknown_pct: number
 * }
 *
 * @param {Object} opts
 * @param {number} [opts.limit=200] - How many latest rows from DB
 * @param {string} [opts.portal] - Optional portal filter
 */
export async function apiSentimentOverview({ limit = 200, portal } = {}) {
  return get("/api/v1/analytics/bd_sentiment_overview", {
    limit,
    portal,
  });
}
