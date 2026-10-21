export default function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3.5 py-3">
      <p className="text-xs text-ink-faint mb-1">{label}</p>
      <p className="font-mono text-base font-semibold text-ink tabular">{value}</p>
    </div>
  );
}
