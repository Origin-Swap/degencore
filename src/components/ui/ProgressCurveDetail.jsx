import { useEffect, useRef, useState } from "react";

export default function ProgressCurve({ progress = 0, graduated = false, className = "" }) {
  const clamped = Math.min(100, Math.max(0, progress));
  const isFull = clamped >= 100 || graduated;

  const accent = graduated ? "#8B5CF6" : "rgb(var(--color-lime))";
  const accentGlow = graduated ? "#C4B5FD" : "rgba(54, 255, 114, 0.5)";
  const trackBg = "rgb(var(--color-surface-alt))";
  const emptyColor = "rgb(var(--color-surface-alt))";
  const borderColor = graduated ? "#8B5CF6" : "rgb(var(--color-lime))";

  const formattedProgress = graduated ? "100%" : `${clamped.toFixed(1)}%`;

  const SEGMENT_COUNT = 20;
  const segmentGap = 1;
  const filledSegments = Math.round((clamped / 100) * SEGMENT_COUNT);

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="relative flex-1">
        <svg
          viewBox="0 0 220 22"
          preserveAspectRatio="none"
          className="w-full block"
          style={{ height: "22px" }}
        >
          <defs>
            <filter id="segGlow" x="-50%" y="-200%" width="200%" height="500%">
              <feGaussianBlur stdDeviation="1.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="borderGlow" x="-20%" y="-100%" width="140%" height="300%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <linearGradient id="segFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accentGlow} />
              <stop offset="50%" stopColor={accent} />
              <stop offset="100%" stopColor={accent} />
            </linearGradient>
          </defs>

          <rect
            x="1"
            y="1"
            width="218"
            fill={trackBg}
            stroke={borderColor}
            strokeWidth="1"
            strokeOpacity="0.3"
            filter="url(#borderGlow)"
            rx="2"
          />

          {Array.from({ length: SEGMENT_COUNT }).map((_, i) => {
            const segWidth = (216 - (SEGMENT_COUNT - 1) * segmentGap) / SEGMENT_COUNT;
            const x = 2 + i * (segWidth + segmentGap);
            const filled = i < filledSegments;

            return (
              <rect
                key={i}
                x={x}
                y="3"
                width={segWidth}
                height="10"
                rx="2"
                fill={filled ? accent : emptyColor}
                filter={filled ? "url(#segGlow)" : undefined}
                style={{ transition: "fill 0.35s ease, stroke 0.35s ease" }}
              />
            );
          })}

          {clamped > 0 && !isFull && (
            <g
              style={{
                transform: `translate(${2 + filledSegments * ((216 - (SEGMENT_COUNT - 1) * segmentGap) / SEGMENT_COUNT + segmentGap)}px, 11px)`,
                transition: "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              <circle r="2" fill={accentGlow} opacity="0.4" className="seg-ping" />
            </g>
          )}
        </svg>
      </div>

      <span className="font-mono text-xs font-medium text-ink-soft tabular w-9 text-right shrink-0">
        {formattedProgress}
      </span>

      <style>{`
        @keyframes segPing {
          0%   { transform: scale(1);   opacity: 0.5; }
          70%  { transform: scale(2.4); opacity: 0; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        .seg-ping {
          transform-origin: center;
          transform-box: fill-box;
          animation: segPing 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
      `}</style>
    </div>
  );
}
