import { ChevronDown } from "lucide-react";

const SORTS = [
  { id: "recent", label: "Recent buys" },
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "marketCap", label: "Market cap" },
  { id: "volume", label: "Volume" },
];

const RANGES = [
  { id: "all", label: "All" },   // ← Tambahkan ini!
  { id: "1h", label: "1h" },
  { id: "12h", label: "12h" },
  { id: "24h", label: "24h" },
  { id: "7d", label: "7d" },
];

const VERSIONS = [
  { id: "both", label: "Both" },
  { id: "v1", label: "v1" },
  { id: "v2", label: "v2" },
];

function Pill({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-ink text-canvas" : "bg-surface border border-border text-ink-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export default function FilterBar({ sort, onSort, range, onRange, version, onVersion }) {
  return (
    <div className="flex items-center gap-2 md:gap-4">
      {/* Mobile: sort as a dropdown select, sharing the row with range */}
      <div className="relative flex-1 min-w-0 md:hidden">
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value)}
          className="w-full appearance-none rounded-full bg-surface border border-border text-sm font-medium text-ink pl-3.5 pr-9 py-2 outline-none"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint"
        />
      </div>

      {/* Desktop: sort as a pill row, inline with everything else */}
      <div className="hidden md:flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none]">
        {SORTS.map((s) => (
          <Pill key={s.id} active={sort === s.id} onClick={() => onSort(s.id)}>
            {s.label}
          </Pill>
        ))}
      </div>

      <div className="flex items-center gap-1.5 bg-surface-alt rounded-full p-1 shrink-0">
        {RANGES.map((r) => (
          <button
            key={r.id}
            onClick={() => onRange(r.id)}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
              range === r.id ? "bg-surface text-ink shadow-sm" : "text-ink-faint"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      {/* <div className="hidden md:flex items-center gap-1.5 bg-surface-alt rounded-full p-1">
        {VERSIONS.map((v) => (
          <button
            key={v.id}
            onClick={() => onVersion(v.id)}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
              version === v.id ? "bg-surface text-ink shadow-sm" : "text-ink-faint"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div> */}
    </div>
  );
}
