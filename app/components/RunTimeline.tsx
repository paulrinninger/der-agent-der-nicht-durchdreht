"use client";

import { memo, useMemo, useState } from "react";
import type { RunState } from "@/src/types";
import { deriveTimeline } from "./derive";
import { useNow } from "./hooks";

/**
 * Live gantt of the whole run: one row per agent, bar = lifespan, notches =
 * tool calls (white executed, red rejected, amber tool error), accent cursor
 * = now. Derived purely from existing traces — the "daten und fakten" view.
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
        <h2 className="font-display text-[11px] uppercase tracking-[0.2em] text-ink-dim">
          lauf-timeline {open ? "▾" : "▸"}
        </h2>
        <span className="font-mono text-[11px] text-ink-dim">
          {model.rows.length + model.hidden} agenten · {(model.spanMs / 1000).toFixed(1).replace(".", ",")}s
        </span>
      </button>

      {open && (
        <div className="tl-scroll mt-3 overflow-x-auto">
          <div className="min-w-[36rem]">
            <div className="relative space-y-[5px]">
              {model.gridlines.map((g) => (
                <div key={g.label} className="tl-grid" style={{ left: `calc(8.5rem + (100% - 8.5rem) * ${g.pct / 100})` }} aria-hidden />
              ))}
              {model.nowPct !== null && (
                <div className="tl-now" style={{ left: `calc(8.5rem + (100% - 8.5rem) * ${model.nowPct / 100})` }} aria-hidden />
              )}
              {model.rows.map((r) => (
                <div key={r.itemId} className="tl-row grid grid-cols-[8.5rem_1fr] items-center" title={r.tooltip}>
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
                      <span key={i} className={`tl-tick tl-tick-${t.kind}`} style={{ left: `${t.pct}%` }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {model.hidden > 0 && (
              <p className="mt-2 font-mono text-[10px] text-ink-dim/60">
                … {model.hidden} weitere agenten ausgeblendet
              </p>
            )}
            <div className="relative mt-1 h-4 ml-[8.5rem]">
              {model.gridlines.map((g) => (
                <span key={g.label} className="tl-axis" style={{ left: `${g.pct}%` }}>
                  {g.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
});
