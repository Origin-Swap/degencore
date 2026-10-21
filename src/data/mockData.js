// Deterministic mock data used ONLY as an offline fallback for local
// frontend-only development. Every page checks BACKEND_CONNECTED (see
// src/config/env.js) and, whenever a real API base URL is configured, uses
// src/data/api.js + src/data/adapters.js instead — nothing in this file is
// imported on that path except the shared GRADIENTS palette below.

const NAMES = [
  ["Ferric", "FERRIC"],
  ["Kyber Mascot", "AIPEX"],
  ["Spacetime", "SPACETIME"],
  ["For The People", "FTP"],
  ["Anon", "ANON"],
  ["Cassette", "TAPE"],
  ["Nightshift", "NIGHT"],
  ["Glasswing", "WING"],
  ["Dustbowl", "DUST"],
  ["Overclock", "CLOCK"],
  ["Paper Boat", "BOAT"],
  ["Loam", "LOAM"],
];

export const GRADIENTS = [
  ["#FF6B6B", "#FFD93D"],
  ["#4ECDC4", "#556270"],
  ["#C6F135", "#1D2400"],
  ["#5B5BD6", "#B8B8F0"],
  ["#FF9A8B", "#FF6A88"],
  ["#08AEEA", "#2AF598"],
  ["#F7971E", "#FFD200"],
  ["#8E2DE2", "#4A00E0"],
];

function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildPriceHistory(seed, points, trendUp = true) {
  const rand = seededRandom(seed);
  let price = 0.00002 + rand() * 0.00004;
  const history = [];
  const now = Date.now();
  for (let i = points; i >= 0; i--) {
    const drift = (trendUp ? 1 : -0.4) * rand() * 0.06;
    const noise = (rand() - 0.5) * 0.03;
    price = Math.max(0.000001, price * (1 + drift + noise));
    history.push({
      time: now - i * 5 * 60 * 1000,
      price,
    });
  }
  return history;
}

function buildTrades(seed, tokenSymbol, count) {
  const rand = seededRandom(seed + 7);
  const trades = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const side = rand() > 0.46 ? "buy" : "sell";
    trades.push({
      id: `${tokenSymbol}-${i}`,
      side,
      trader: `0x${Math.floor(rand() * 0xffffff).toString(16).padStart(4, "0")}…${Math.floor(
        rand() * 0xffff
      )
        .toString(16)
        .padStart(4, "0")}`,
      amountToken: Math.round(rand() * 900000 + 1000),
      amountUsd: +(rand() * 1200 + 8).toFixed(2),
      time: now - i * (30 + rand() * 240) * 1000,
    });
  }
  return trades;
}

function buildHolders(seed, count) {
  const rand = seededRandom(seed + 13);
  let remaining = 100;
  const holders = [];
  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    const pct = isLast ? remaining : +(remaining * (0.05 + rand() * 0.35)).toFixed(2);
    remaining = +(remaining - pct).toFixed(2);
    holders.push({
      address: `0x${Math.floor(rand() * 0xffffff)
        .toString(16)
        .padStart(6, "0")}…${Math.floor(rand() * 0xffff).toString(16).padStart(4, "0")}`,
      pct: Math.max(pct, 0.01),
      isCurve: i === 0,
      isCreator: i === 1,
    });
  }
  return holders.sort((a, b) => b.pct - a.pct);
}

export const PAIR_TOKENS = [
  { symbol: "BOT", label: "BOT", decimals: 18 },
  { symbol: "USDT", label: "USDT", decimals: 6 },
];

export const TOKENS = NAMES.map(([name, symbol], i) => {
  const seed = i * 9301 + 49297;
  const graduated = i % 7 === 1;
  const progress = graduated ? 100 : Math.round(8 + seededRandom(seed + 3)() * 90);
  const marketCap = Math.round(4000 + seededRandom(seed + 5)() * 60000);
  const createdMinsAgo = Math.round(seededRandom(seed + 9)() * 60 * 24 * 3);

  return {
    address: `0x${(seed * 12345).toString(16).padStart(40, "0").slice(0, 40)}`,
    curveAddress: `0x${(seed * 54321).toString(16).padStart(40, "0").slice(0, 40)}`,
    name,
    symbol,
    description:
      i % 3 === 0
        ? ""
        : `${name} is a community-run experiment paired against ${
            i % 2 === 0 ? "BOT" : "USDT"
          }. No presale, no team allocation — the curve is the whole story.`,
    gradient: GRADIENTS[i % GRADIENTS.length],
    pairSymbol: i % 2 === 0 ? "BOT" : "USDT",
    // undefined = native asset (BOT); otherwise the ERC20 address wagmi's
    // useBalance should read from. Replace with the real USDT address per chain.
    pairTokenAddress: i % 2 === 0 ? undefined : "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    version: i % 5 === 0 ? "v2" : "v1",
    creator: `0x${(seed * 111).toString(16).padStart(40, "0").slice(0, 40)}`,
    marketCapUsd: marketCap,
    liquidityUsd: Math.round(marketCap * (0.25 + seededRandom(seed + 11)() * 0.2)),
    volume24hUsd: Math.round(marketCap * (0.1 + seededRandom(seed + 17)() * 0.6)),
    athUsd: Math.round(marketCap * (1 + seededRandom(seed + 19)() * 0.8)),
    bondingProgressPct: progress,
    graduated,
    createdMinsAgo,
    websiteUrl: i % 4 !== 0 ? "https://" : "",
    xUrl: i % 4 !== 0 ? "https://x.com" : "",
    telegramUrl: i % 3 !== 0 ? "https://t.me" : "",
    priceHistory: buildPriceHistory(seed, 64, i % 3 !== 2),
    recentTrades: buildTrades(seed, symbol, 22),
    holders: buildHolders(seed, 9),
  };
});

export function getTokenBySymbol(symbol) {
  return TOKENS.find((t) => t.symbol.toLowerCase() === symbol.toLowerCase());
}

export const GLOBAL_STATS = {
  totalLaunched: 268116,
};

function buildLeaderboard(count) {
  const rand = seededRandom(777331);
  const entries = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    // Points skew toward a long tail, like real trading-activity leaderboards:
    // a handful of very active wallets, most people just a few trades.
    const points = Math.max(1, Math.round(2500 * Math.pow(rand(), 3)) - i * 2);
    const tradeCount = points; // 1 point per trade, by design — see backend README
    const firstTradeMinsAgo = Math.round(30 + rand() * 60 * 24 * 45);
    const lastTradeMinsAgo = Math.round(rand() * Math.min(firstTradeMinsAgo, 60 * 24 * 3));

    entries.push({
      address: `0x${(i * 928371 + 1000003).toString(16).padStart(40, "0").slice(0, 40)}`,
      points: Math.max(1, points),
      tradeCount: Math.max(1, tradeCount),
      firstTradeMinsAgo,
      lastTradeMinsAgo,
    });
  }

  return entries
    .sort((a, b) => b.points - a.points)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}

export const LEADERBOARD = buildLeaderboard(120);

export const LEADERBOARD_STATS = {
  totalParticipants: LEADERBOARD.length * 47, // pretend most participants aren't in the top-120 slice
  totalPointsIssued: LEADERBOARD.reduce((sum, e) => sum + e.points, 0) * 47,
};

export function getLeaderboardRankFor(address) {
  if (!address) return null;
  return LEADERBOARD.find((e) => e.address.toLowerCase() === address.toLowerCase()) || null;
}

export function formatRelativeTime(msAgo) {
  const sec = Math.max(0, Math.round(msAgo / 1000));
  if (sec < 5) return "now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

export function formatUsd(value) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(2)}`;
}

// ── FIX: was `value.toFixed(8)` unconditionally for anything < 0.0001.
// toFixed(8) only has 8 decimal places of resolution — any price smaller
// than 5e-9 rounds straight to "0.00000000", which the trailing-zero strip
// then collapsed to a bare "0" ($0.000000001363... became "$0."). Early
// bonding-curve prices (10^-8 to 10^-10 range) hit this constantly.
//
// Fix: pick the decimal count adaptively from the value's own magnitude —
// enough digits to show a few significant figures — instead of a fixed 8.
// Normal-range prices (>= 0.0001) are unaffected, still toFixed(6) as before.
export function formatPrice(value) {
  const n = Number(value) || 0;
  if (n === 0) return "$0";
  if (n >= 0.0001) return `$${n.toFixed(6)}`;

  const magnitude = Math.floor(Math.log10(n)); // e.g. -9 for 1.36e-9
  const decimals = Math.min(18, Math.max(8, -magnitude + 3)); // a few sig figs of headroom, floor of 8 to match old behavior for the least-tiny values
  const str = n.toFixed(decimals).replace(/0+$/, "").replace(/\.$/, "");
  return `$${str}`;
}
