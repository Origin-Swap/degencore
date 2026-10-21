function truncateAddress(address, front = 6, back = 4) {
  if (!address) return "";
  if (address.length <= front + back + 3) return address;
  return `${address.slice(0, front)}...${address.slice(-back)}`;
}

function formatBalance(value, symbol = "") {
  if (value === undefined || value === null) return "0";

  const num = Number(value);
  if (isNaN(num)) return "0";

  const abs = Math.abs(num);
  let formatted;

  if (abs >= 1_000_000_000) {
    formatted = (num / 1_000_000_000).toFixed(2) + "B";
  } else if (abs >= 1_000_000) {
    formatted = (num / 1_000_000).toFixed(2) + "M";
  } else if (abs >= 1_000) {
    formatted = (num / 1_000).toFixed(2) + "K";
  } else {
    formatted = num.toFixed(2);
  }

  return symbol ? `${formatted} ${symbol}` : formatted;
}

export default function HoldersTable({ holders, symbol }) {
  return (
    <div className="divide-y divide-border">
      {holders.map((h, i) => (
        <div key={h.address} className="flex items-center justify-between py-2.5 text-sm gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-5 text-xs text-ink-faint font-mono tabular shrink-0">{i + 1}</span>
            <span className="font-mono text-ink" title={h.address}>
              {truncateAddress(h.address)}
            </span>
            {h.isCurve && (
              <span className="shrink-0 text-[10px] font-semibold uppercase text-indigo bg-indigo-soft rounded-md px-1.5 py-0.5">
                Curve
              </span>
            )}
            {h.isCreator && (
              <span className="shrink-0 text-[10px] font-semibold uppercase text-ink-soft bg-surface-alt rounded-md px-1.5 py-0.5">
                Creator
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-mono tabular text-ink-soft" title={String(h.balance ?? 0)}>
              {formatBalance(h.balance ?? 0, symbol)}
            </span>
            <span className="font-mono tabular text-ink-soft w-14 text-right">{h.pct.toFixed(2)}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}
