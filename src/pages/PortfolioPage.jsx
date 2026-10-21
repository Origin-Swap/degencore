import { useEffect, useMemo, useState } from "react";
import { useAccount, useWriteContract, useChainId, useChains } from "wagmi";
import { Wallet2, Copy, Check, ExternalLink, TrendingUp, TrendingDown, Sparkles, Crown, Users } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import EmptyState from "../components/ui/EmptyState";
import { fetchPortfolio } from "../data/api";
import { mapPortfolio } from "../data/adapters";
import { BONDING_CURVE_ABI } from "../config/contracts";

function formatUsd(n) {
  if (n == null || Number.isNaN(n)) return "$0.00";
  const abs = Math.abs(n);
  const opts = abs >= 1000 ? { maximumFractionDigits: 0 } : { maximumFractionDigits: 2 };
  return (n < 0 ? "-$" : "$") + abs.toLocaleString("en-US", opts);
}

function formatToken(n) {
  if (n == null || Number.isNaN(n)) return "0";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function truncateAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function avatarGradient(address) {
  let hash = 0;
  for (let i = 0; i < (address || "").length; i++) {
    hash = (hash * 31 + address.charCodeAt(i)) >>> 0;
  }
  const h1 = hash % 360;
  const h2 = (h1 + 60) % 360;
  return `linear-gradient(135deg, hsl(${h1} 70% 55%), hsl(${h2} 70% 45%))`;
}

function PnlBadge({ value, pct, size = "sm" }) {
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  const isHero = size === "hero";
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono tabular font-medium ${
        positive ? "text-up" : "text-down"
      } ${isHero ? "text-lg" : "text-sm"}`}
    >
      <Icon size={isHero ? 18 : 13} />
      {positive ? "+" : ""}
      {formatUsd(value)}
      {pct != null && (
        <span className="opacity-70 text-xs font-normal ml-0.5">
          ({positive ? "+" : ""}
          {pct.toFixed(1)}%)
        </span>
      )}
    </span>
  );
}

function TokenCell({ row }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {row.imageUrl ? (
        <img src={row.imageUrl} alt={row.symbol} className="w-8 h-8 rounded-full object-cover shrink-0" />
      ) : (
        <div
          className="w-8 h-8 rounded-full shrink-0"
          style={{ background: row.gradient || avatarGradient(row.symbol) }}
        />
      )}
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink truncate">{row.symbol}</div>
        <div className="text-xs text-ink-soft truncate">{row.name}</div>
      </div>
    </div>
  );
}

function ClaimRewardButton({ curveAddress, functionName, args = [], label }) {
  const { writeContract, isPending, isSuccess } = useWriteContract();

  return (
    <button
      onClick={() =>
        writeContract({ address: curveAddress, abi: BONDING_CURVE_ABI, functionName, args })
      }
      disabled={isPending || isSuccess}
      className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-lime hover:bg-lime-dark text-lime-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {isSuccess ? "Claimed" : isPending ? "Claiming…" : label}
    </button>
  );
}

function RewardRow({ row, kind }) {
  return (
    <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
      <TokenCell row={row} />
      <div className="flex items-center gap-3 shrink-0 ml-3">
        <div className="text-right">
          <div className="text-sm font-mono tabular font-medium text-ink">
            {formatToken(row.pendingDisplay)} {row.pairSymbol}
          </div>
          <div className="text-xs font-mono tabular text-ink-soft">{formatUsd(row.pendingUsd)}</div>
        </div>
        <ClaimRewardButton
          curveAddress={row.curveAddress}
          functionName={kind === "creator" ? "claimCreatorFees" : "claimCashback"}
          label="Claim"
        />
      </div>
    </div>
  );
}

function RewardSection({ title, subtitle, icon: Icon, rows, kind, totalUsd }) {
  if (!rows.length) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-1.5">
          <Icon size={13} className="text-ink-soft" />
          <h3 className="text-xs font-semibold text-ink uppercase tracking-wide">{title}</h3>
        </div>
        <span className="font-mono tabular text-xs font-semibold text-ink-soft">{formatUsd(totalUsd)}</span>
      </div>
      <p className="text-[11px] text-ink-faint mb-2">{subtitle}</p>
      <div className="divide-y divide-ink/10">
        {rows.map((row) => (
          <RewardRow key={`${kind}-${row.curveAddress}`} row={row} kind={kind} />
        ))}
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const chains = useChains();

  // Deteksi simbol native secara dinamis (ETH, BOT, BNB, dll)
  const chain = chains.find((c) => c.id === chainId);
  const nativeSymbol = chain?.nativeCurrency?.symbol ?? "ETH";

  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isConnected || !address) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPortfolio(address)
      .then((data) => {
        if (!cancelled) setPortfolio(mapPortfolio(data));
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load portfolio");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address, isConnected]);

  const totals = useMemo(() => {
    if (!portfolio) return { holdingsUsd: 0, unrealizedUsd: 0, realizedUsd: 0 };
    const holdingsUsd = portfolio.holdings.reduce((s, r) => s + r.valueUsd, 0);
    const unrealizedUsd = portfolio.holdings.reduce((s, r) => s + r.unrealizedPnlUsd, 0);
    const realizedUsd = portfolio.history.reduce((s, r) => s + r.realizedPnlUsd, 0);
    return { holdingsUsd, unrealizedUsd, realizedUsd };
  }, [portfolio]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-24 px-6">
        <div className="w-12 h-12 rounded-2xl bg-surface-alt flex items-center justify-center mb-4">
          <Wallet2 size={20} className="text-ink-soft" />
        </div>
        <h2 className="font-display text-lg font-semibold text-ink mb-1.5">Connect a wallet</h2>
        <p className="text-sm text-ink-soft max-w-sm mb-5">
          Connect to see the tokens you hold and the curves you've launched.
        </p>
        <ConnectButton />
      </div>
    );
  }

  if (loading && !portfolio) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-ink-soft">Loading portfolio…</p>
      </div>
    );
  }

  if (error) {
    return <EmptyState icon={Wallet2} title="Couldn't load portfolio" description={error} />;
  }

  const rewards = portfolio?.rewards;
  const creatorRows = rewards?.creator || [];
  const cashbackRows = rewards?.cashback || [];
  const hasRewards = creatorRows.length > 0 || cashbackRows.length > 0;
  const creatorTotalUsd = creatorRows.reduce((s, r) => s + (r.pendingUsd || 0), 0);
  const cashbackTotalUsd = cashbackRows.reduce((s, r) => s + (r.pendingUsd || 0), 0);
  const totalRewardsUsd = creatorTotalUsd + cashbackTotalUsd;
  const totalPnlUsd = totals.unrealizedUsd + totals.realizedUsd;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl font-semibold text-ink mb-6">Portfolio</h1>

      {/* --- Identity strip --- */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-8 h-8 rounded-full shrink-0" style={{ background: avatarGradient(address) }} />
        <span className="font-mono text-sm text-ink-soft">{truncateAddress(address)}</span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-ink-faint hover:text-ink transition-colors"
          aria-label="Copy address"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>

      {/* --- Hero --- */}
      <div className="mb-8">
        <p className="text-sm text-ink-soft mb-1.5">Holdings value</p>
        <p className="font-display text-5xl font-semibold text-ink tabular tracking-tight mb-2">
          {formatUsd(totals.holdingsUsd)}
        </p>
        <PnlBadge value={totalPnlUsd} size="hero" />
        <span className="text-sm text-ink-faint ml-2">all-time</span>
      </div>

      {/* --- Secondary stats --- */}
      <div className="grid grid-cols-3 divide-x divide-border border-y border-border py-4 mb-8">
        <div className="px-4 first:pl-0">
          {/* MENGGUNAKAN SIMBOL DINAMIS */}
          <p className="text-xs text-ink-soft mb-1">{nativeSymbol} balance</p>
          <p className="font-mono tabular text-base font-medium text-ink">
            {formatToken(portfolio?.nativeBalance?.display)} {nativeSymbol}
          </p>
        </div>
        <div className="px-4">
          <p className="text-xs text-ink-soft mb-1">Unrealized</p>
          <p className={`font-mono tabular text-base font-medium ${totals.unrealizedUsd >= 0 ? "text-up" : "text-down"}`}>
            {totals.unrealizedUsd >= 0 ? "+" : ""}
            {formatUsd(totals.unrealizedUsd)}
          </p>
        </div>
        <div className="px-4">
          <p className="text-xs text-ink-soft mb-1">Realized</p>
          <p className={`font-mono tabular text-base font-medium ${totals.realizedUsd >= 0 ? "text-up" : "text-down"}`}>
            {totals.realizedUsd >= 0 ? "+" : ""}
            {formatUsd(totals.realizedUsd)}
          </p>
        </div>
      </div>

      {/* --- Pending rewards --- */}
      {hasRewards && (
        <div className="mb-8 rounded-xl2 bg-lime/10 border border-lime/30 px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-lime-ink" />
              <h2 className="text-sm font-semibold text-ink">Unclaimed rewards</h2>
            </div>
            <span className="font-mono tabular text-sm font-semibold text-ink">{formatUsd(totalRewardsUsd)}</span>
          </div>

          <div className="space-y-4">
            <RewardSection
              title="Creator rewards"
              subtitle="Your share of trading fees from tokens you launched."
              icon={Crown}
              rows={creatorRows}
              kind="creator"
              totalUsd={creatorTotalUsd}
            />
            {creatorRows.length > 0 && cashbackRows.length > 0 && <div className="h-px bg-ink/10" />}
            <RewardSection
              title="Trader cashback"
              subtitle="Your share of fees from tokens you've bought or sold."
              icon={Users}
              rows={cashbackRows}
              kind="cashback"
              totalUsd={cashbackTotalUsd}
            />
          </div>
        </div>
      )}

      {/* --- Holdings --- */}
      <div className="mb-8">
        <h2 className="font-display text-sm font-semibold text-ink mb-3">Holdings</h2>
        {portfolio?.holdings.length ? (
          <div className="overflow-x-auto rounded-xl2 border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-faint border-b border-border">
                  <th className="font-medium py-2.5 px-4">Token</th>
                  <th className="font-medium py-2.5 px-4 text-right">Balance</th>
                  <th className="font-medium py-2.5 px-4 text-right">Value</th>
                  <th className="font-medium py-2.5 px-4 text-right">PnL</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.holdings.map((row) => (
                  <tr key={row.curveAddress} className="border-b border-border last:border-0 hover:bg-surface-alt/50 transition-colors">
                    <td className="py-3 px-4">
                      <TokenCell row={row} />
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular text-ink">
                      {formatToken(row.heldTokens)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular text-ink">
                      {formatUsd(row.valueUsd)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <PnlBadge value={row.unrealizedPnlUsd} pct={row.totalPnlPct} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Wallet2} title="No tokens held" description="Bought tokens will show up here." />
        )}
      </div>

      {/* --- History --- */}
      <div>
        <h2 className="font-display text-sm font-semibold text-ink mb-3">History</h2>
        {portfolio?.history.length ? (
          <div className="overflow-x-auto rounded-xl2 border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-faint border-b border-border">
                  <th className="font-medium py-2.5 px-4">Token</th>
                  <th className="font-medium py-2.5 px-4 text-right">Bought</th>
                  <th className="font-medium py-2.5 px-4 text-right">Sold</th>
                  <th className="font-medium py-2.5 px-4 text-right">Realized PnL</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.history.map((row) => (
                  <tr key={row.curveAddress} className="border-b border-border last:border-0 hover:bg-surface-alt/50 transition-colors">
                    <td className="py-3 px-4">
                      <TokenCell row={row} />
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular text-ink-soft">
                      {formatUsd(row.totalBoughtUsd)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular text-ink-soft">
                      {formatUsd(row.totalSoldUsd)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <PnlBadge value={row.totalPnlUsd} pct={row.totalPnlPct} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={ExternalLink}
            title="No trade history yet"
            description="Tokens you've bought or sold will show up here with your PnL."
          />
        )}
      </div>
    </div>
  );
}
