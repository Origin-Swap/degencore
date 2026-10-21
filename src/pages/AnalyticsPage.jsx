import { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import EmptyState from "../components/ui/EmptyState";
import StatCard from "../components/ui/StatCard";
import { fetchOverview, fetchDailyVolume } from "../data/api";
import { formatUsd } from "../data/mockData";

const RANGE_OPTIONS = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

function formatCompactDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// 🔥 Custom Tooltip agar tampilannya ikut Dark/Light Mode
function ChartTooltip({ active, payload, label, isCurrency = false }) {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  return (
    <div className="rounded-lg bg-ink text-canvas text-xs px-3 py-2 shadow-popover transition-colors">
      <p className="text-canvas/60 mb-1">{label}</p>
      <p className="font-mono font-semibold">
        {isCurrency ? formatUsd(value) : Number(value).toLocaleString()}
      </p>
    </div>
  );
}

function MiniAreaChart({ data, dataKey, label, colorVar }) {
  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <XAxis dataKey="label" hide />
          <YAxis hide />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: "rgb(var(--color-border))", strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            // Menggunakan format rgb(var(--...)) agar terbaca oleh SVG
            stroke={`rgb(var(${colorVar}))`}
            fill={`rgb(var(${colorVar}))`}
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function AnalyticsPage() {
  const [overview, setOverview] = useState(null);
  const [daily, setDaily] = useState([]);
  const [days, setDays] = useState(30);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    Promise.all([fetchOverview(), fetchDailyVolume({ days })])
      .then(([overviewRow, dailyRows]) => {
        if (cancelled) return;
        setOverview(overviewRow);
        setDaily(
          (dailyRows || []).map((r) => ({
            date: r.date,
            label: formatCompactDate(r.date),
            volumeUsd: Number(r.volumeUsd) || 0,
            tradeCount: Number(r.tradeCount) || 0,
            newTokens: Number(r.newTokens) || 0,
            newTraders: Number(r.newTraders) || 0,
            graduatedCount: Number(r.graduatedCount) || 0,
          }))
        );
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[analytics] failed to load stats:", err);
        setError(err.message || "Failed to load analytics");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [days]);

  const totalVolumeInRange = useMemo(
    () => daily.reduce((sum, d) => sum + d.volumeUsd, 0),
    [daily]
  );

  const graduationRatePct =
    overview?.totalLaunched
      ? (Number(overview.totalGraduated || 0) / Number(overview.totalLaunched)) * 100
      : 0;

  if (error) {
    return (
      <div className="px-4 lg:px-8 py-10 text-center">
        <p className="text-ink font-medium">Couldn't load analytics.</p>
        <p className="text-sm text-ink-soft mt-1">{error}</p>
      </div>
    );
  }

  if (isLoading && !overview) {
    return (
      <div className="px-4 lg:px-8 py-10 text-center">
        <p className="text-ink font-medium">Loading analytics…</p>
      </div>
    );
  }

  if (!overview) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No analytics yet"
        description="Protocol-wide volume, fees, and graduation rate will render here once token_stats rollups are indexed."
      />
    );
  }

  return (
    <div className="px-4 lg:px-8 py-6 max-w-[1400px] mx-auto">
      <div className="mb-5">
        <h1 className="font-display text-lg font-semibold text-ink">Analytics</h1>
        <p className="text-sm text-ink-soft mt-0.5">Protocol-wide activity, all-time.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-6">
        <StatCard label="Total volume" value={formatUsd(overview.totalVolumeUsd)} />
        <StatCard
          label="Total trades"
          value={Number(overview.totalTrades || 0).toLocaleString()}
        />
        <StatCard
          label="Tokens launched"
          value={Number(overview.totalLaunched || 0).toLocaleString()}
        />
        <StatCard
          label="Graduated"
          value={`${Number(overview.totalGraduated || 0).toLocaleString()} (${graduationRatePct.toFixed(1)}%)`}
        />
      </div>

      <div className="rounded-xl2 bg-surface border border-border p-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Daily volume</p>
            <p className="text-xs text-ink-faint mt-0.5">
              {formatUsd(totalVolumeInRange)} over the last {days}d
            </p>
          </div>
          <div className="flex items-center gap-1 bg-surface-alt rounded-full p-1 w-fit">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                onClick={() => setDays(opt.days)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  days === opt.days ? "bg-surface text-ink shadow-sm" : "text-ink-faint hover:text-ink-soft"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {daily.length === 0 ? (
          <p className="text-sm text-ink-soft py-10 text-center">
            No trading activity in this range yet.
          </p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(var(--color-lime))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="rgb(var(--color-lime))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                {/* Grid adaptif */}
                <CartesianGrid vertical={false} stroke="rgb(var(--color-border))" strokeDasharray="4 6" />
                {/* Sumbu X & Y adaptif */}
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "rgb(var(--color-ink-faint))" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "rgb(var(--color-ink-faint))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatUsd(v)}
                  width={70}
                />
                {/* Tooltip kustom */}
                <Tooltip
                  content={<ChartTooltip isCurrency />}
                  cursor={{ stroke: "rgb(var(--color-border))", strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="volumeUsd"
                  stroke="rgb(var(--color-lime))"
                  fill="url(#volumeGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {daily.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="rounded-xl2 bg-surface border border-border p-4">
            <p className="text-sm font-semibold text-ink mb-3">New tokens / day</p>
            <MiniAreaChart
              data={daily}
              dataKey="newTokens"
              label="New tokens"
              colorVar="--color-indigo"
            />
          </div>
          <div className="rounded-xl2 bg-surface border border-border p-4">
            <p className="text-sm font-semibold text-ink mb-3">New traders / day</p>
            <MiniAreaChart
              data={daily}
              dataKey="newTraders"
              label="New traders"
              colorVar="--color-up"
            />
          </div>
          <div className="rounded-xl2 bg-surface border border-border p-4">
            <p className="text-sm font-semibold text-ink mb-3">Graduations / day</p>
            <MiniAreaChart
              data={daily}
              dataKey="graduatedCount"
              label="Graduated"
              colorVar="--color-indigo"
            />
          </div>
        </div>
      )}
    </div>
  );
}
