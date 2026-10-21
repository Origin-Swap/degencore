import { Crown, Users } from "lucide-react";

function formatRewardAmount(amount) {
  if (!amount) return "0";
  if (amount >= 1) return amount.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (amount >= 0.0001) return amount.toLocaleString(undefined, { maximumFractionDigits: 6 });

  const magnitude = Math.floor(Math.log10(amount));
  const decimals = Math.min(18, Math.max(8, -magnitude + 2));
  const str = amount.toFixed(decimals).replace(/0+$/, "").replace(/\.$/, "");
  return str;
}

export default function RewardsBanner({ token }) {
  const creatorTotal = Number(token?.totalCreatorRewardsPairAmount) || 0;
  const cashbackTotal = Number(token?.totalCashbackRewardsPairAmount) || 0;
  const pairSymbol = token?.pairSymbol || "";

  const rewardMode = Number(token?.rewardMode ?? 0);
  const isCreatorMode = rewardMode === 0;

  const activeTotal = isCreatorMode ? creatorTotal : cashbackTotal;
  const hasAnyRewards = activeTotal > 0;

  if (!hasAnyRewards) {
    return (
      <div className="rounded-xl2">
        <p className="text-sm font-semibold text-ink">
          {isCreatorMode
            ? "Be the first trade — the creator earns on every trade"
            : "Be the first trade — earn cashback on every trade"}
        </p>
        <p className="text-xs text-ink-faint mt-0.5">
          {isCreatorMode
            ? "This token pays 1% of every trade to the creator. Earnings will show up here as soon as the first trade goes through."
            : "This token pays 1% of every trade back to traders as cashback. Your share will show up here as soon as the first trade goes through."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl2 border border-border p-4">
      <p className="text-xs text-ink-faint mb-3">Total rewards distributed from this token</p>

      <div className="flex items-center gap-2.5">
        {isCreatorMode ? (
          <div className="shrink-0 w-9 h-9 rounded-full bg-indigo-soft flex items-center justify-center">
            <Crown size={16} className="text-indigo" />
          </div>
        ) : (
          <div className="shrink-0 w-9 h-9 rounded-full bg-lime/15 flex items-center justify-center">
            <Users size={16} className="text-lime-dark" />
          </div>
        )}
        <div className="min-w-0">
          <p className="font-mono text-base font-semibold text-ink tabular leading-tight truncate">
            {formatRewardAmount(activeTotal)}{" "}
            <span className="text-xs text-ink-soft">{pairSymbol}</span>
          </p>
          <p className="text-[11px] text-ink-faint">
            {isCreatorMode ? "Earned by creator" : "Earned by traders"}
          </p>
        </div>
      </div>

      <p className="text-[11px] text-ink-faint mt-3">
        {isCreatorMode
          ? "Creator mode: 1% of every trade goes to the token creator."
          : "Cashback mode: 1% of every trade goes back to traders. Already traded this token? Check your share on the portfolio page."}
      </p>
    </div>
  );
}
