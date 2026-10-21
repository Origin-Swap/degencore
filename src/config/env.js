// Reads the indexer/API base URL from the Vite env (set VITE_API_BASE_URL in
// .env / .env.production, e.g. "https://api.yourapp.xyz" — no trailing slash
// needed, it's stripped below).
//
// BACKEND_CONNECTED is the single switch every data-fetching page checks:
// when it's true, pages hit the real backend (src/data/api.js) and the
// mock dataset in src/data/mockData.js is never imported from; when it's
// false (no env var set — e.g. plain `vite dev` with no backend running),
// pages fall back to the bundled mock data so the UI still renders.
// export const API_BASE_URL = "https://qurve.online";
export const API_BASE_URL = "http://localhost:4000";
export const BACKEND_CONNECTED = Boolean(API_BASE_URL);
