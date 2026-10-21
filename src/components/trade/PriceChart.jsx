import { useEffect, useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatUsd } from "../../data/mockData";
import { BACKEND_CONNECTED } from "../../config/env";
import { fetchCandles } from "../../data/api";
import { mapApiCandle } from "../../data/adapters";

const RANGES = ["5m", "1h", "6h", "1d", "ALL"];

const RANGE_TO_CANDLES = {
  "5m": { interval: "1m", limit: 5 },
  "1h": { interval: "1m", limit: 60 },
  "6h": { interval: "5m", limit: 72 },
  "1d": { interval: "5m", limit: 288 },
  ALL: { interval: "1h", limit: 500 },
};

function ChartTooltip({ active, payload, symbol }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg bg-ink text-canvas text-xs px-3 py-2 shadow-popover">
      <p className="font-mono font-semibold">{symbol} market cap</p>
      <p className="font-mono tabular">{formatUsd(point.marketCap)}</p>
      <p className="text-canvas/60 mt-0.5">
        {new Date(point.time).toLocaleString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          month: "short",
          day: "numeric",
        })}
      </p>
    </div>
  );
}

export default function PriceChart({ token }) {
  const [range, setRange] = useState("1h");

  const [apiCandles, setApiCandles] = useState([]);
  const [isLoading, setIsLoading] = useState(BACKEND_CONNECTED);

  const identifier = token.address || token.curveAddress;

  useEffect(() => {
    if (!BACKEND_CONNECTED || !identifier) return;

    let cancelled = false;
    setIsLoading(true);

    const { interval, limit } = RANGE_TO_CANDLES[range];
    fetchCandles(identifier, { interval, limit })
      .then((rows) => {
        if (cancelled) return;
        const points = (rows || []).map(mapApiCandle).sort((a, b) => a.time - b.time);
        setApiCandles(points);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[price-chart] failed to load candles:", err);
        setApiCandles([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [identifier, range]);

  const mockData = useMemo(() => {
    const points = token.priceHistory || [];
    const slice = { "5m": 6, "1h": 16, "6h": 40, "1d": points.length, ALL: points.length }[range];
    return points.slice(-slice);
  }, [range, token]);

  const priceData = BACKEND_CONNECTED ? apiCandles : mockData;

  const latestPrice = priceData[priceData.length - 1]?.price;
  const usdMultiplier = token.marketCapUsd && latestPrice ? token.marketCapUsd / latestPrice : 0;

  const data = useMemo(
    () => priceData.map((d) => ({ ...d, marketCap: d.price * usdMultiplier })),
    [priceData, usdMultiplier]
  );

  const trendUp = data[data.length - 1]?.marketCap >= data[0]?.marketCap;
  // Menggunakan warna dari CSS variables
  const lineColor = trendUp ? "rgb(var(--color-up))" : "rgb(var(--color-down))";

  const rangeChangePct = useMemo(() => {
    if (data.length < 2) return null;
    const first = data[0]?.marketCap;
    const last = data[data.length - 1]?.marketCap;
    if (!first || first === 0) return null;
    return ((last - first) / first) * 100;
  }, [data]);

  const latestMarketCap = data[data.length - 1]?.marketCap;

  return (
    <div className="rounded-xl2 bg-surface border border-border p-4 transition-colors">
      {latestMarketCap != null && (
        <div className="flex items-baseline gap-2 mb-2">
          <span className="font-display text-2xl font-semibold text-ink tabular">
            {formatUsd(latestMarketCap)}
          </span>
          {rangeChangePct != null && (
            <span
              className={`text-sm font-semibold tabular ${
                rangeChangePct >= 0 ? "text-up" : "text-down"
              }`}
            >
              {rangeChangePct >= 0 ? "+" : ""}
              {rangeChangePct.toFixed(2)}%
            </span>
          )}
          <span className="text-xs text-ink-faint">{range}</span>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1 bg-surface-alt rounded-full p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                range === r ? "bg-surface text-ink shadow-sm" : "text-ink-faint hover:text-ink-soft"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64 md:h-80 -mx-2">
        {BACKEND_CONNECTED && isLoading && data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-ink-faint">
            Loading chart…
          </div>
        ) : data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-ink-faint">
            No trades yet for this range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="marketCapFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgb(var(--color-border))" strokeDasharray="4 6" />
              <XAxis
                dataKey="time"
                tickFormatter={(t) => new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                tick={{ fontSize: 11, fill: "rgb(var(--color-ink-faint))" }}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                dataKey="marketCap"
                domain={["auto", "auto"]}
                tickFormatter={(v) => formatUsd(v)}
                tick={{ fontSize: 11, fill: "rgb(var(--color-ink-faint))" }}
                axisLine={false}
                tickLine={false}
                width={64}
              />
              <Tooltip content={<ChartTooltip symbol={token.symbol} />} cursor={{ stroke: "rgb(var(--color-border))", strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="marketCap"
                stroke={lineColor}
                strokeWidth={2}
                fill="url(#marketCapFill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
