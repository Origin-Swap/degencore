import { formatRelativeTime } from "../../data/mockData";

function truncateAddress(address, front = 6, back = 4) {
  if (!address) return "";
  if (address.length <= front + back + 3) return address;
  return `${address.slice(0, front)}...${address.slice(-back)}`;
}

export default function TradesTable({ trades, symbol }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ink-faint border-b border-border">
            <th className="font-medium py-2 pr-3">Type</th>
            <th className="font-medium py-2 pr-3">Trader</th>
            <th className="font-medium py-2 pr-3 text-right">{symbol}</th>
            <th className="font-medium py-2 pr-3 text-right">USD</th>
            <th className="font-medium py-2 text-right">Time</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr key={trade.id} className="border-b border-border last:border-0 hover:bg-surface-alt/60">
              <td className="py-2 pr-3">
                <span
                  className={`inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase ${
                    trade.side === "buy" ? "bg-up/10 text-up" : "bg-down/10 text-down"
                  }`}
                >
                  {trade.side}
                </span>
              </td>
              <td className="py-2 pr-3 font-mono text-ink-soft" title={trade.trader}>
                {truncateAddress(trade.trader)}
              </td>
              <td className="py-2 pr-3 text-right font-mono tabular text-ink">
                {trade.amountToken.toLocaleString()}
              </td>
              <td className="py-2 pr-3 text-right font-mono tabular text-ink-soft">
                ${trade.amountUsd.toLocaleString()}
              </td>
              <td className="py-2 text-right text-ink-faint text-xs">
                {formatRelativeTime(Date.now() - trade.time)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
