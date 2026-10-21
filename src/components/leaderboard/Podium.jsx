import { formatRelativeTime } from "../../data/mockData";

const RANK_STYLE = {
  1: { medal: "#F5B700", label: "1st", order: "sm:order-2", ring: "ring-2 ring-[#F5B700]" },
  2: { medal: "#9CA3AF", label: "2nd", order: "sm:order-1", ring: "" },
  3: { medal: "#C97C3D", label: "3rd", order: "sm:order-3", ring: "" },
};

function Avatar({ address, color }) {
  return (
    <div
      className="w-12 h-12 rounded-full flex items-center justify-center font-display font-semibold text-white shrink-0"
      style={{ background: color }}
      aria-hidden="true"
    >
      {address.slice(2, 4).toUpperCase()}
    </div>
  );
}

export default function Podium({ entries }) {
  if (entries.length < 3) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {entries.slice(0, 3).map((entry) => {
        const style = RANK_STYLE[entry.rank];
        return (
          <div
            key={entry.address}
            className={`rounded-xl2 bg-surface border border-border shadow-card p-4 flex flex-col items-center text-center gap-2 ${style.order} ${style.ring} ${
              entry.rank === 1 ? "sm:py-6" : ""
            }`}
          >
            <span
              className="text-[11px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5"
              style={{ color: style.medal, backgroundColor: `${style.medal}1A` }}
            >
              {style.label}
            </span>
            <Avatar address={entry.address} color={style.medal} />
            <p className="font-mono text-sm text-ink truncate max-w-full">
              {entry.address.slice(0, 6)}…{entry.address.slice(-4)}
            </p>
            <p className="font-mono text-xl font-semibold text-ink tabular">{entry.points.toLocaleString()}</p>
            <p className="text-xs text-ink-faint">
              {entry.tradeCount.toLocaleString()} trades · active {formatRelativeTime(entry.lastTradeMinsAgo * 60 * 1000)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
