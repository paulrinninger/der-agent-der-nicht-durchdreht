"use client";

import { memo, useMemo, useState } from "react";
import type { RunState } from "@/src/types";
import { deriveTimeline } from "./derive";
import { useNow } from "./hooks";

const LABEL = "11rem"; // name column — one constant, used in all four places

/**
 * Live gantt of the whole run: one row per agent, bar = lifespan, notches =
 * tool calls, accent cursor = now. Derived purely from existing traces.
 */
export const RunTimeline = memo(function RunTimeline({
  run,
  live,
}: {
  run: RunState;
  live: boolean;
}) {
  const [open, setOpen] = useState(true);
  const now = useNow(live);
  const model = useMemo(() => deriveTimeline(run, now), [run, now]);

  if (model.rows.length === 0) return null;

  return (
    <section className="glass mb-4 p-5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-baseline justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <h2 className="panel-title">lauf-timeline {open ? "▾" : "▸"}</h2>
        <span className="panel-meta">
          {model.rows.length + model.hidden} agenten ·{" "}
          {(model.spanMs / 1000).toFixed(1).replace(".", ",")}s
        </span>
      </button>

      {open && (
        <>
          <p className="panel-sub">
            eine zeile pro agent: balken = laufzeit, kerben = einzelne tool-calls.
          </p>
          <div className="tl-scroll mt-3 overflow-x-auto">
            <div className="min-w-[40rem]">
              <div className="relative space-y-[5px]">
                {model.gridlines.map((g) => (
                  <div
                    key={g.label}
                    className="tl-grid"
                    style={{ left: `calc(${LABEL} + (100% - ${LABEL}) * ${g.pct / 100})` }}
                    aria-hidden
                  />
                ))}
                {model.nowPct !== null && (
                  <div
                    className="tl-now"
                    style={{ left: `calc(${LABEL} + (100% - ${LABEL}) * ${model.nowPct / 100})` }}
                    aria-hidden
                  />
                )}
                {model.rows.map((r) => (
                  <div
                    key={r.itemId}
                    className="tl-row grid items-center"
                    style={{ gridTemplateColumns: `${LABEL} 1fr` }}
                    title={r.tooltip}
                  >
                    <span className="tl-name">{r.name.toLowerCase()}</span>
                    <div className="tl-track relative">
                      <div
                        className={`tl-bar tl-${r.status}`}
                        style={{
                          left: `${r.startPct}%`,
                          width: `${Math.max(0.6, r.endPct - r.startPct)}%`,
                        }}
                      />
                      {r.ticks.map((t, i) => (
                        <span
                          key={i}
                          className={`tl-tick tl-tick-${t.kind}`}
                          style={{ left: `${t.pct}%` }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {model.hidden > 0 && (
                <p className="mt-2 font-mono text-[11px] text-ink-dim/60">
                  … {model.hidden} weitere agenten ausgeblendet
                </p>
              )}
              <div className="relative mt-1 h-4" style={{ marginLeft: LABEL }}>
                {model.gridlines.map((g) => (
                  <span key={g.label} className="tl-axis" style={{ left: `${g.pct}%` }}>
                    {g.label}
                  </span>
                ))}
              </div>
              <div className="legend mt-3">
                <span className="legend-label">balken:</span>
                <span>
                  <i className="legend-swatch legend-swatch-running" /> läuft
                </span>
                <span>
                  <i className="legend-swatch legend-swatch-completed" /> fertig
                </span>
                <span>
                  <i className="legend-swatch legend-swatch-failed" /> fehler
                </span>
                <span>
                  <i className="legend-swatch legend-swatch-aborted" /> gestoppt
                </span>
                <span className="legend-label">kerben:</span>
                <span>
                  <i className="legend-tick legend-tick-executed" /> tool ok
                </span>
                <span>
                  <i className="legend-tick legend-tick-rejected" /> abgelehnt
                </span>
                <span>
                  <i className="legend-tick legend-tick-error" /> tool-fehler
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
});
