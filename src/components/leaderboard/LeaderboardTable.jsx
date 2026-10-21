import { formatRelativeTime } from "../../data/mockData";

export default function LeaderboardTable({ entries }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl2 border border-dashed border-border bg-surface py-16 text-center">
        <p className="text-sm font-medium text-ink">No matching wallets</p>
        <p className="text-xs text-ink-soft mt-1">Try a different address.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl2 bg-surface border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ink-faint border-b border-border bg-surface-alt/60">
            <th className="font-medium py-2.5 pl-4 pr-2 w-14">Rank</th>
            <th className="font-medium py-2.5 pr-2">Wallet</th>
            <th className="font-medium py-2.5 pr-2 text-right">Points</th>
            <th className="font-medium py-2.5 pr-2 text-right hidden sm:table-cell">Trades</th>
            <th className="font-medium py-2.5 pr-4 text-right">Active</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.address} className="border-b border-border last:border-0 hover:bg-surface-alt/60">
              <td className="py-2.5 pl-4 pr-2 font-mono text-ink-faint tabular">{entry.rank}</td>
              <td className="py-2.5 pr-2 font-mono text-ink">
                {entry.address.slice(0, 6)}…{entry.address.slice(-4)}
              </td>
              <td className="py-2.5 pr-2 text-right font-mono font-semibold text-ink tabular">
                {entry.points.toLocaleString()}
              </td>
              <td className="py-2.5 pr-2 text-right font-mono text-ink-soft tabular hidden sm:table-cell">
                {entry.tradeCount.toLocaleString()}
              </td>
              <td className="py-2.5 pr-4 text-right text-ink-faint text-xs">
                {formatRelativeTime(entry.lastTradeMinsAgo * 60 * 1000)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
