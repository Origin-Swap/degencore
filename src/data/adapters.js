import { GRADIENTS } from "./mockData";

// Deterministic gradient pick so a given token always renders the same
// placeholder colors across reloads, same idea as mockData's seeded picks —
// just keyed off the real token address instead of an array index.
function gradientFor(seedKey) {
  let hash = 0;
  const str = String(seedKey || "");
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return GRADIENTS[hash % GRADIENTS.length];
}

function minutesAgo(isoOrDate) {
  if (!isoOrDate) return 0;
  const ms = Date.now() - new Date(isoOrDate).getTime();
  return Math.max(0, Math.round(ms / 60000));
}

// tokenService.js's listTokens()/getTokenDetail() return raw MySQL rows
// (snake_case column names). This maps a row onto the exact field names
// ExplorePage/TokenCard already expect from mockData.js's TOKENS array.
export function mapApiToken(row) {
  return {
    address: row.token_address,
    curveAddress: row.curve_address,
    name: row.name,
    symbol: row.symbol,
    description: row.description || "",
    imageUrl: row.image_url || null,
    gradient: gradientFor(row.token_address || row.symbol),
    pairSymbol: row.pair_symbol,
    // undefined = native asset (ETH), same convention TradePanel/mockData use
    // for wagmi's useBalance `token` param.
    pairTokenAddress: row.pair_token_address || undefined,
    version: row.version,
    creator: row.creator_address,
    rewardMode: Number(row.reward_mode ?? 0),
    marketCapUsd: Number(row.market_cap_usd) || 0,
    liquidityUsd: Number(row.liquidity_usd) || 0,
    volume24hUsd: Number(row.volume_24h_usd) || 0,
    volume7dUsd: Number(row.volume_7d_usd) || 0,
    athUsd: Number(row.ath_usd) || 0,
    lastPrice: Number(row.last_price) || 0,
    bondingProgressPct: Number(row.bonding_progress_pct) || 0,
    graduated: Boolean(row.graduated),
    graduatedAt: row.graduated_at,
    totalCreatorRewardsPairAmount:
      Number(row.total_creator_rewards_wei) / 10 ** (row.pair_decimals ?? 18) || 0,
    totalCashbackRewardsPairAmount:
      Number(row.total_cashback_rewards_wei) / 10 ** (row.pair_decimals ?? 18) || 0,
    dexPairAddress: row.dex_pair_address || null,
    tokensForSale: Number(row.tokens_for_sale) / 1e18 || 0,
    tokensSold: Number(row.tokens_sold) / 1e18 || 0,
    tokensForLiquidity: Number(row.tokens_for_liquidity) / 1e18 || 0,
    createdMinsAgo: minutesAgo(row.created_at),
    websiteUrl: row.website_url || "",
    xUrl: row.x_url || "",
    telegramUrl: row.telegram_url || "",
  };
}

// candles rows (curve_address, interval, bucket_time, open, high, low,
// close, volume) mapped onto the {time, price} shape PriceChart already
// expects from token.priceHistory in the mock data.
export function mapApiCandle(row) {
  return {
    time: new Date(row.bucket_time).getTime(),
    price: Number(row.close),
  };
}

// trades rows mapped onto the shape TradesTable already expects from
// mockData's buildTrades(): {id, side, trader, amountToken, amountUsd, time}.
// `time` here is an absolute timestamp (ms) — TradesTable does
// Date.now() - trade.time itself when formatting, same as it does for mock rows.
// tokenService.js's getTrades() selects tx_hash but not id/log_index, so
// tx_hash is the best available uniqueness key (one trade per tx here).
export function mapApiTrade(row) {
  return {
    id: row.id ?? row.tx_hash,
    side: row.side,
    trader: row.trader_address,
    amountToken: Number(row.token_amount) || 0,
    amountUsd: Number(row.amount_usd) || 0,
    time: row.block_time ? new Date(row.block_time).getTime() : Date.now(),
  };
}

// tokenService.js's getHolders() already renames holder_address -> address
// and computes pct itself (balance / tokens_for_sale * 100), so this is
// mostly a passthrough into HoldersTable's {address, pct, isCurve, isCreator}
// shape, plus tagging the curve/creator rows.
export function mapApiHolder(row, { curveAddress, creatorAddress, totalSupply } = {}) {
  const address = row.address ?? row.holder_address;
  let pct = 0;
  if (row.pct != null) {
    pct = Number(row.pct);
  } else if (totalSupply) {
    pct = (Number(row.balance) / totalSupply) * 100;
  }
  return {
    address,
    balance: Number(row.balance) || 0,
    pct,
    isCurve: curveAddress ? address?.toLowerCase() === curveAddress.toLowerCase() : false,
    isCreator: creatorAddress ? address?.toLowerCase() === creatorAddress.toLowerCase() : false,
  };
}

// user_points rows (address, points, trade_count, first_trade_at,
// last_trade_at) mapped onto the camelCase + "minutes ago" shape
// mockData.js's buildLeaderboard() produces. `rank` is assigned by
// whoever calls this against the full sorted list (see LeaderboardPage),
// since a single row on its own (e.g. from GET /leaderboard/:address)
// doesn't know its position among everyone else.
export function mapLeaderboardEntry(row, rank) {
  return {
    address: row.address,
    points: Number(row.points) || 0,
    tradeCount: Number(row.trade_count) || 0,
    firstTradeMinsAgo: minutesAgo(row.first_trade_at),
    lastTradeMinsAgo: minutesAgo(row.last_trade_at),
    ...(rank !== undefined ? { rank } : {}),
  };
}

export function mapPortfolioRow(row) {
  return {
    ...row,
    gradient: gradientFor(row.tokenAddress || row.curveAddress || row.symbol),
  };
}

export function mapPortfolio(portfolio) {
  if (!portfolio) return null;
  return {
    address: portfolio.address,
    nativeBalance: portfolio.nativeBalance,
    holdings: portfolio.holdings.map(mapPortfolioRow),
    history: portfolio.history.map(mapPortfolioRow),
    rewards: {
      ...portfolio.rewards,
      creator: portfolio.rewards.creator.map(mapPortfolioRow),
      cashback: portfolio.rewards.cashback.map(mapPortfolioRow),
    },
  };
}
