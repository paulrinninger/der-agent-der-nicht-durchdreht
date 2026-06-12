"use client";

import { memo } from "react";
import type { BurnPoint } from "./hooks";

/**
 * Token-burn sparkline. Y normalizes to the series max (not the limit) — the
 * sparkline shows burn SHAPE, the gauge shows proportion of budget.
 */
export const Sparkline = memo(function Sparkline({
  series,
  live,
}: {
  series: BurnPoint[];
  live: boolean;
}) {
  if (series.length < 2) {
    return <div className="h-9 rounded-md border border-white/5 bg-black/20" aria-hidden />;
  }
  const t0 = series[0].t;
  const t1 = Math.max(series[series.length - 1].t, t0 + 1);
  const maxUsed = Math.max(...series.map((p) => p.used), 1);
  const pts = series.map((p) => {
    const x = ((p.t - t0) / (t1 - t0)) * 100;
    const y = 26 - (p.used / maxUsed) * 24;
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `0,28 ${line} 100,28`;
  const [lx, ly] = pts[pts.length - 1];

  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-9 w-full" aria-hidden>
      <defs>
        <linearGradient id="burn-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(125,211,252,0.18)" />
          <stop offset="1" stopColor="rgba(125,211,252,0)" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#burn-fill)" />
      <polyline
        points={line}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      {live && <circle cx={lx} cy={ly} r="2" fill="var(--color-accent)" className="pipe-dot-active" />}
    </svg>
  );
});
