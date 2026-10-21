import { Link } from "react-router-dom";
import { X as XIcon, Send } from "lucide-react";
import TokenAvatar from "../ui/TokenAvatar";
import Badge from "../ui/Badge";
import ProgressCurve from "../ui/ProgressCurve";
import { formatUsd, formatRelativeTime } from "../../data/mockData";

export default function TokenCard({ token }) {
  return (
    <Link
      to={`/token/${token.symbol}`}
      className="group flex flex-col gap-1 rounded-xl2 bg-surface border border-border shadow-card hover:border-border-strong hover:-translate-y-0.5 transition-all overflow-hidden"
    >
      <div className="relative w-full aspect-square pt-2 px-2">
        <TokenAvatar token={token} size="100%" className="w-full h-full rounded-xl" />
        {token.graduated && (
          <div className="absolute top-2.5 right-4">
            <Badge variant="indigo">Graduated</Badge>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 px-4 pb-4">
        <div>
          <h3 className="md:text-md text-[16px] font-semibold truncate">
            {token.name} <span className="text-xs"> (${token.symbol}) </span>
          </h3>
          {/*<p className="text-xs text-ink-faint font-mono mt-0.5">${token.symbol}</p>*/}
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-sm text-ink-soft">Market Cap</span>
          <span className="font-mono text-sm font-semibold text-ink tabular">
            {formatUsd(token.marketCapUsd)}
          </span>
        </div>
        <ProgressCurve progress={token.bondingProgressPct} graduated={token.graduated} />
        <div className="flex items-center justify-between text-[11px] text-ink-faint font-mono pt-1 border-t border-border">
          <span className="truncate">
            {token.address.slice(0, 6)}…{token.address.slice(-4)}
          </span>
          <span className="text-up font-medium shrink-0">
            {formatRelativeTime(token.createdMinsAgo * 60 * 1000)}
          </span>
        </div>
      </div>
    </Link>
  );
}
