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
    } catch (_) {
      // ignore
    }
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  // FastAPI always returns JSON here
  return res.json();
}

/**
 * Generic GET helper with query params.
 * @param {string} path - e.g. "/api/v1/news/latest"
 * @param {Record<string, string | number | undefined>} [params]
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
 * Health check: GET /api/v1/health
 * @returns {Promise<{status: string}>}
 */
export async function apiHealth() {
  return get("/api/v1/health");
}

/**
 * Latest news (DB-backed feed).
 * GET /api/v1/news/latest
 *
 * @param {Object} [opts]
 * @param {number} [opts.limit=10]
 * @param {number} [opts.offset=0]
 * @param {string} [opts.portal] - Optional portal id, e.g. "prothomalo", "bbc"
 * @returns {Promise<{count:number, limit:number, offset:number, items:Array}>}
 */
export async function apiLatestNews({ limit = 10, offset = 0, portal } = {}) {
  return get("/api/v1/news/latest", {
    limit,
    offset,
    portal,
  });
}

/**
 * News by topic (DB-backed feed).
 * GET /api/v1/news/by_topic
 *
 * @param {Object} opts
 * @param {string} opts.topic - e.g. "politics", "sports", "health"
 * @param {number} [opts.limit=10]
 * @param {number} [opts.offset=0]
 * @param {string} [opts.portal] - Optional portal filter
 */
export async function apiNewsByTopic({
  topic,
  limit = 10,
  offset = 0,
  portal,
} = {}) {
  if (!topic) {
    throw new Error("topic is required for apiNewsByTopic");
  }

  return get("/api/v1/news/by_topic", {
    topic,
    limit,
    offset,
    portal,
  });
}

/**
 * Live keyword fetch (RSS-based).
 * GET /api/v1/news/search
 *
 * @param {Object} opts
 * @param {string} opts.q - Raw user query, e.g. "bitcoin, tesla"
 * @param {string} [opts.lang] - Optional lang filter: "en", "bn", "english", "bangla"
 * @param {string} [opts.country] - Optional country filter: "bd", "intl", etc.
 *
 * Response shape:
 * {
 *   raw_query: string,
 *   lang: string | null,
 *   country: string | null,
 *   keywords: string[],
 *   total_fetched: number,
 *   by_keyword: {
 *     [kw: string]: Array<{
 *       title: string,
 *       url: string,
 *       summary: string | null,
 *       content: string | null,
 *       source: string,
 *       keyword: string,
 *       published_at: string | null
 *     }>
 *   }
 * }
 */
export async function apiKeywordFetch({ q, lang, country } = {}) {
  const query = (q || "").trim();
  if (!query) {
    throw new Error("q (keyword query) is required for apiKeywordFetch");
  }

  return get("/api/v1/news/search", {
    q: query,
    lang,
    country,
  });
}

/**
 * Fetch a single article by URL (DB-backed).
 * GET /api/v1/news/by_url
 *
 * @param {string} url - Exact article URL stored in DB
 * @returns {Promise<{found:boolean, item:object|null}>}
 */
export async function apiNewsByUrl(url) {
  if (!url) {
    throw new Error("url is required for apiNewsByUrl");
  }

  return get("/api/v1/news/by_url", { url });
}
