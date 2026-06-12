"use client";

import { memo, useMemo } from "react";
import type { RunState } from "@/src/types";
import { deriveTokenSeries, formatT } from "./derive";
import { useNow } from "./hooks";
import { num } from "./labels";

/**
 * Token-Verlauf (aus dem KI-Engineering-Mockup): kumulierte Tokens über die
 * Laufzeit, das harte Budget als gestrichelte Linie, Guardrail-Stopps als
 * Kerben. Fläche + Linie als SVG; Limit, Marks und Achse als HTML-Overlays,
 * damit Dashes nicht verzerren und die Marks [data-tip]-Tooltips bekommen.
 */
export const TokenChart = memo(function TokenChart({
  run,
  live,
}: {
  run: RunState;
  live: boolean;
}) {
  const now = useNow(live);
  const m = useMemo(() => deriveTokenSeries(run, now), [run, now]);

  const total = m.points[m.points.length - 1]?.total ?? 0;
  const x = (ts: number) => ((ts - m.t0) / m.spanMs) * 100;
  const y = (v: number) => 100 - (v / m.maxY) * 100;

  // step-after: tokens kommen diskret an, die linie springt am commit
  const line = m.points
    .map((p, i) => {
      const px = x(p.ts).toFixed(2);
      const py = y(p.total).toFixed(2);
      if (i === 0) return `M ${px} ${py}`;
      return `L ${px} ${y(m.points[i - 1].total).toFixed(2)} L ${px} ${py}`;
    })
    .join(" ");
  const area = `${line} L 100 100 L 0 100 Z`;
  const limitTop = (1 - m.limit / m.maxY) * 100;

  return (
    <section className="insight-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span
          className="label"
          data-tip="Jeder LLM-Call bucht seine Tokens aufs globale Budget — die Kurve ist der kumulierte Verbrauch des ganzen Batches."
        >
          Token-Verlauf
        </span>
        {live ? (
          <span className="live-dot mono">
            <span className="pulse-dot" /> live
          </span>
        ) : (
          <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
            {num(total)} / {num(m.limit)} Tokens
          </span>
        )}
      </div>

      <div className="chart-wrap">
        {m.gridlines.map((g) => (
          <div key={g.pct} className="chart-grid" style={{ left: `${g.pct}%` }} />
        ))}
        <svg className="chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path className="chart-area" d={area} />
          <path className="chart-line" d={line} vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="chart-limit" style={{ top: `${limitTop}%` }}>
          <span className="chart-limit-label">Limit {num(m.limit)}</span>
        </div>
        {m.stopMarks.map((s) => (
          <span
            key={`${s.label}:${s.ts}`}
            className={"chart-mark " + (s.kind === "run" ? "chart-mark-run" : "chart-mark-guard")}
            style={{ left: `${x(s.ts)}%`, top: `${y(s.total)}%` }}
            data-tip={`${formatT(s.ts, m.t0)} · ${s.label}`}
          />
        ))}
      </div>

      <div className="chart-axis">
        <span className="chart-axis-start">t+0s</span>
        {m.gridlines.map((g) => (
          <span key={g.pct} className="chart-axis-tick" style={{ left: `${g.pct}%` }}>
            {g.label}
          </span>
        ))}
        <span className="chart-axis-end">{formatT(m.tEnd, m.t0)}</span>
      </div>

      <p className="caption" style={{ margin: "10px 0 0" }}>
        Kumulierte Tokens über die Laufzeit — die gestrichelte Linie ist das harte Budget.
        Kerben markieren gestoppte Agenten.
      </p>
    </section>
  );
});
