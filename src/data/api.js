import { API_BASE_URL } from "../config/env";

// Mirrors the mount prefixes used for tokens.routes.js / stats.routes.js /
// leaderboard.routes.js / upload.routes.js in the backend's app.js. Adjust
// these if the real app mounts them under different paths.
const PATHS = {
  tokens: "/api/tokens",
  stats: "/api/stats",
  leaderboard: "/api/leaderboard",
  upload: "/api/upload",
  portfolio: "/api/portfolio",
};

async function request(path, { method = "GET", params, body, isForm = false } = {}) {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  const res = await fetch(url.toString(), {
    method,
    credentials: "include", // sends the ascend_session cookie from auth.controller.js
    headers: isForm ? undefined : { "Content-Type": "application/json" },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      message = data?.error || data?.message || message;
    } catch {
      // Response wasn't JSON (e.g. an HTML error page from a proxy) — keep
      // the generic status-based message above.
    }
    throw new Error(message);
  }

  // Some endpoints (POST /metadata) may return 204/empty bodies.
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// --- tokens.routes.js ---
// tokens.controller.js wraps every response in an envelope object
// ({ tokens }, { token }, { candles }, { trades }, { holders }) rather than
// returning the array/row directly — unwrapped here so callers (ExplorePage,
// TokenDetailPage, PriceChart, adapters.js) can work with plain arrays/rows.

export function fetchTokens({ sort, range, version, search, page, limit } = {}) {
  return request(PATHS.tokens, { params: { sort, range, version, search, page, limit } }).then(
    (data) => data.tokens
  );
}

export function fetchToken(identifier) {
  return request(`${PATHS.tokens}/${identifier}`).then((data) => data.token);
}

export function searchTokens(query, { limit = 8 } = {}) {
  return request(PATHS.tokens, { params: { search: query, limit } }).then(
    (data) => data.tokens
  );
}

export function fetchCandles(identifier, { interval, limit } = {}) {
  return request(`${PATHS.tokens}/${identifier}/candles`, { params: { interval, limit } }).then(
    (data) => data.candles
  );
}

export function fetchTrades(identifier, { page, limit } = {}) {
  return request(`${PATHS.tokens}/${identifier}/trades`, { params: { page, limit } }).then(
    (data) => data.trades
  );
}

export function fetchHolders(identifier, limit) {
  return request(`${PATHS.tokens}/${identifier}/holders`, { params: { limit } }).then(
    (data) => data.holders
  );
}

export function updateTokenMetadata(identifier, { description, imageUrl, websiteUrl, xUrl, telegramUrl, timestamp, signature } = {}) {
  return request(`${PATHS.tokens}/${identifier}/metadata`, {
    method: "POST",
    body: {
      description,
      imageUrl,
      websiteUrl,
      xUrl,
      telegramUrl,
      timestamp,    // ← Tambahkan!
      signature     // ← Tambahkan!
    },
  });
}

// --- stats.routes.js ---

export function fetchGlobalStats() {
  return request(`${PATHS.stats}/global`);
}

// stats.controller.js's getOverview() returns platformStatsService's row
// directly with res.json(overview) (no envelope key), unlike most other
// endpoints here — so this is NOT unwrapped with a `.then(data => ...)`.
export function fetchOverview() {
  return request(`${PATHS.stats}/overview`);
}

// getDailyVolume() wraps its result as { daily }, same envelope pattern as
// fetchTokens/fetchTrades/fetchHolders above.
export function fetchDailyVolume({ days } = {}) {
  return request(`${PATHS.stats}/daily-volume`, { params: { days } }).then((data) => data.daily);
}

// --- leaderboard.routes.js ---

export function fetchLeaderboard(params) {
  return request(PATHS.leaderboard, { params });
}

export function fetchUserRank(address) {
  return request(`${PATHS.leaderboard}/${address}`);
}

// --- upload.routes.js ---

export function uploadImage(file) {
  const form = new FormData();
  form.append("image", file);
  return request(`${PATHS.upload}/image`, { method: "POST", body: form, isForm: true });
}

export function fetchPortfolio(address) {
  if (!address) return Promise.resolve(null);
  return request(`${PATHS.portfolio}/${address}`).then((data) => data.portfolio);
}
