import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Flame, ExternalLink, X as XIcon, Send, Globe } from "lucide-react";
import { FaXTwitter } from "react-icons/fa6";
import { FaTelegramPlane } from "react-icons/fa";
import { CgWebsite } from "react-icons/cg";
import TokenAvatar from "../components/ui/TokenAvatar";
import Badge from "../components/ui/Badge";
import StatCard from "../components/ui/StatCard";
import ProgressCurve from "../components/ui/ProgressCurveDetail";
import RewardsBanner from "../components/ui/Rewardsbanner";
import PriceChart from "../components/trade/PriceChart";
import TradePanel from "../components/trade/TradePanel";
import TradesTable from "../components/trade/TradesTable";
import HoldersTable from "../components/trade/HoldersTable";
import { BACKEND_CONNECTED } from "../config/env";
import { fetchToken, fetchTrades, fetchHolders } from "../data/api";
import { mapApiToken, mapApiTrade, mapApiHolder } from "../data/adapters";
import { getTokenBySymbol, formatUsd, formatPrice } from "../data/mockData";

// Guards against xUrl/telegramUrl being stored without a scheme (e.g.
// "x.com/foo" instead of "https://x.com/foo") — without this, `<a href="x.com/foo">`
// gets treated as a RELATIVE path by the browser and resolves against the
// current page's own origin (localhost:5173/x.com/foo), not the external
// site. This is a render-time safety net; if you can, also fix this at
// wherever xUrl/telegramUrl get saved (the metadata edit form/endpoint) so
// the stored value is correct at the source too — this just makes sure a
// bad value already in the database can't break the link either way.
function ensureAbsoluteUrl(url) {
  if (!url) return url;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export default function TokenDetailPage() {
  const { symbol } = useParams();
  const [tab, setTab] = useState("trades");

  // Only used on the BACKEND_CONNECTED path — the mock path below still
  // reads straight from the bundled TOKENS array, same as before.
  const [apiToken, setApiToken] = useState(null);
  const [trades, setTrades] = useState([]);
  const [holders, setHolders] = useState([]);
  const [isLoading, setIsLoading] = useState(BACKEND_CONNECTED);
  const [loadError, setLoadError] = useState(null);

  // Initial token load — kept separate from the refresh effect below so a
  // symbol change always shows the "Loading token…" state, while periodic
  // refreshes (refreshKey) update quietly in the background instead.
  useEffect(() => {
    if (!BACKEND_CONNECTED) return;

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setApiToken(null);

    fetchToken(symbol)
      .then((row) => {
        if (cancelled) return;
        setApiToken(mapApiToken(row));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[token-detail] failed to load token:", err);
        setLoadError(err.message || "Failed to load token");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  // Trades/holders/token-stats refresh. Previously this only ran once (its
  // dependency was `[symbol, apiToken]`, and apiToken itself only ever
  // changes once per symbol) — so the recent-trades table, holders list,
  // and header price all silently froze at whatever they were when the
  // page first loaded. A trade made afterwards (buy OR sell, by this
  // browser or anyone else) never showed up until a manual page reload.
  //
  // Fix: key this effect off `refreshKey` instead, and bump `refreshKey`
  // both (a) right after this browser's own trade confirms — see
  // `onTradeConfirmed` passed to TradePanel below — and (b) on a 15s
  // interval as a safety net for trades made by other users/tabs.
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!BACKEND_CONNECTED || !apiToken) return;

    let cancelled = false;

    fetchTrades(symbol, { limit: 50 })
      .then((rows) => {
        if (!cancelled) setTrades((rows || []).map(mapApiTrade));
      })
      .catch((err) => console.error("[token-detail] failed to load trades:", err));

    fetchHolders(symbol, 20)
      .then((rows) => {
        if (cancelled) return;

        const mapped = (rows || []).map((row) =>
          mapApiHolder(row, {
            curveAddress: apiToken.curveAddress,
            creatorAddress: apiToken.creator,
          })
        );

        // holder_balances (what fetchHolders reads) only tracks addresses
        // that actually bought/sold THROUGH the curve — it never includes
        // the curve contract's own remaining balance (unsold
        // tokensForSale + the tokensForLiquidity reserved for the DEX pool
        // at graduation). So that row is built here instead, from the
        // token's own supply fields, and merged in.
        //
        // NOTE: this assumes apiToken.tokensForSale / tokensSold /
        // tokensForLiquidity are already human-readable numbers (same
        // convention as tokensForSale used server-side in getHolders() —
        // see tokenService.js, which divides the raw wei value by 1e18
        // before using it). If mapApiToken() names or scales these
        // differently, adjust the three field reads below to match.
        const curveAddr = apiToken.curveAddress?.toLowerCase();
        const withoutCurve = mapped.filter((m) => m.address?.toLowerCase() !== curveAddr);

        let combined = withoutCurve;
        if (!apiToken.graduated && curveAddr) {
          const tokensForSale = Number(apiToken.tokensForSale) || 0;
          const tokensSold = Number(apiToken.tokensSold) || 0;
          const tokensForLiquidity = Number(apiToken.tokensForLiquidity) || 0;
          const curveBalance = Math.max(0, tokensForSale - tokensSold) + tokensForLiquidity;
          const totalSupply = tokensForSale + tokensForLiquidity;

          // Other rows' pct (computed server-side) is "% of tokensForSale"
          // only (see getHolders() in tokenService.js). The curve's own
          // balance includes tokensForLiquidity too, which was never part
          // of that denominator — reusing it here would show the curve
          // sitting at >100% right after launch. Using total supply
          // instead keeps this one row honest, though it means this pct
          // isn't on the exact same basis as the other rows above it.
          const curvePct = totalSupply > 0 ? (curveBalance / totalSupply) * 100 : 0;

          combined = [
            {
              address: apiToken.curveAddress,
              balance: curveBalance,
              pct: curvePct,
              isCurve: true,
              isCreator: false,
            },
            ...withoutCurve,
          ];
        }

        setHolders(combined);
      })
      .catch((err) => console.error("[token-detail] failed to load holders:", err));

    // Stats (price, market cap, liquidity, bonding progress) live on the
    // token row itself — refresh it too so the header doesn't go stale
    // alongside the trades list. Uses setApiToken (not a separate state)
    // so this stays the single source of truth for the header numbers.
    fetchToken(symbol)
      .then((row) => {
        if (!cancelled) setApiToken(mapApiToken(row));
      })
      .catch((err) => console.error("[token-detail] failed to refresh token:", err));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally
    // NOT depending on `apiToken` here: it's only read for curveAddress/
    // creator/supply fields (stable per symbol, or re-set at the end of
    // this same effect), so including it would just make the effect
    // re-trigger itself.
  }, [symbol, refreshKey]);

  // Safety-net polling: catches trades made by other users/tabs too, not
  // just the one this browser just submitted via TradePanel.
  useEffect(() => {
    if (!BACKEND_CONNECTED) return;
    const id = setInterval(() => setRefreshKey((k) => k + 1), 15000);
    return () => clearInterval(id);
  }, []);

  const mockToken = !BACKEND_CONNECTED ? getTokenBySymbol(symbol) : null;
  const token = BACKEND_CONNECTED
    ? apiToken
      ? { ...apiToken, recentTrades: trades, holders }
      : null
    : mockToken;

  if (BACKEND_CONNECTED && loadError) {
    return (
      <div className="px-4 lg:px-8 py-10 text-center">
        <p className="text-ink font-medium">Couldn't load token.</p>
        <p className="text-sm text-ink-soft mt-1">{loadError}</p>
        <Link to="/" className="text-sm text-indigo font-medium mt-2 inline-block">
          Back to Explore
        </Link>
      </div>
    );
  }

  if (BACKEND_CONNECTED && isLoading && !token) {
    return (
      <div className="px-4 lg:px-8 py-10 text-center">
        <p className="text-ink font-medium">Loading token…</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="px-4 lg:px-8 py-10 text-center">
        <p className="text-ink font-medium">Token not found.</p>
        <Link to="/" className="text-sm text-indigo font-medium mt-2 inline-block">
          Back to Explore
        </Link>
      </div>
    );
  }

  const lastPrice = BACKEND_CONNECTED
    ? token.lastPrice || 0
    : token.priceHistory[token.priceHistory.length - 1].price;

    const tokenAddr = token.address;

  return (
    <div className="px-4 lg:px-8 py-2 max-w-[1400px] mx-auto">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink mb-4"
      >
        <ArrowLeft size={15} /> Back
      </Link>

      {/* About row */}
      <div className="rounded-xl2 bg-surface border border-border p-4 mb-2 flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <TokenAvatar token={token} size={52} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-lg font-semibold text-ink truncate">{token.name}</h1>
              {token.graduated && <Badge variant="indigo">Graduated</Badge>}
            </div>
            <p className="text-sm text-ink-soft mt-0.5">
              {token.description || "No description yet."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
        {token.websiteUrl && (
          <a
            href={ensureAbsoluteUrl(token.websiteUrl)}
            target="_blank"
            rel="noreferrer"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-alt hover:bg-border-strong/30"
            aria-label="website"
          >
            <CgWebsite size={14} />
          </a>
        )}
          {token.xUrl && (
            <a
              href={ensureAbsoluteUrl(token.xUrl)}
              target="_blank"
              rel="noreferrer"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-alt hover:bg-border-strong/30"
              aria-label="X profile"
            >
              <FaXTwitter size={14} />
            </a>
          )}
          {token.telegramUrl && (
            <a
              href={ensureAbsoluteUrl(token.telegramUrl)}
              target="_blank"
              rel="noreferrer"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-alt hover:bg-border-strong/30"
              aria-label="Telegram"
            >
              <FaTelegramPlane size={14} />
            </a>
          )}
          {/* <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-ink-soft bg-surface-alt rounded-full px-2.5 py-1.5">
            <Flame size={12} /> 0 burned
          </span> */}
          {tokenAddr && (
            <a
              href={`https://scan.botchain.ai/token/${tokenAddr}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft bg-surface-alt rounded-full px-2.5 py-1.5 hover:text-ink"
            >
              Contract <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>
      <div className="rounded-xl2 bg-surface border border-border p-4 mb-2 flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
        <RewardsBanner token={token} size={52} />
      </div>

      {/* Trade + chart */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 mb-4">
        <div className="order-2 lg:order-1">
          <TradePanel token={token} onTradeConfirmed={() => setRefreshKey((k) => k + 1)} />
        </div>

        <div className="order-1 lg:order-2 flex flex-col gap-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            <StatCard label="Price" value={formatPrice(lastPrice)} />
            <StatCard label="Market cap" value={formatUsd(token.marketCapUsd)} />
            {/*<StatCard label="Liquidity" value={formatUsd(token.liquidityUsd)} /> */}
            <StatCard label="24h volume" value={formatUsd(token.volume24hUsd)} />
          </div>

          {/* 🔥 Hanya tampilkan ProgressCurve jika belum graduated */}
          {!token.graduated && (
            <div>
              <p className="text-xs text-ink-faint mb-1.5">Bonding curve progress</p>
              <ProgressCurve progress={token.bondingProgressPct} graduated={token.graduated} />
            </div>
          )}

          <PriceChart token={token} />
        </div>
      </div>

      {/* Trades / holders */}
      <div className="rounded-xl2 bg-surface border border-border p-4">
        <div className="flex items-center gap-1 bg-surface-alt rounded-full p-1 w-fit mb-3">
          {[
            { id: "trades", label: "Recent trades" },
            { id: "holders", label: "Holders" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab === t.id ? "bg-surface text-ink shadow-sm" : "text-ink-faint"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "trades" ? (
          <TradesTable trades={token.recentTrades} symbol={token.symbol} />
        ) : (
          <HoldersTable holders={token.holders} symbol={token.symbol} />
        )}
      </div>
    </div>
  );
}
