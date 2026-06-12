"use client";

import { memo, useMemo, useState } from "react";
import type { RunState } from "@/src/types";
import { deriveTimeline } from "./derive";
import { useNow } from "./hooks";

const LABEL = "11rem"; // Namensspalte — eine Konstante für alle vier Stellen

/**
 * Live-Gantt über den ganzen Lauf: ein Balken pro Agent (Laufzeit), Kerben
 * pro Tool-Call, Cursor = jetzt. Rein aus den vorhandenen Traces abgeleitet.
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
    <section className="tl-panel" data-tour="timeline">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-baseline justify-between gap-3 text-left"
        style={{ background: "none", border: "none", cursor: "pointer", font: "inherit", color: "inherit", padding: 0 }}
        aria-expanded={open}
      >
        <span className="label">Lauf-Timeline {open ? "▾" : "▸"}</span>
        <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
          {model.rows.length + model.hidden} Agenten ·{" "}
          {(model.spanMs / 1000).toFixed(1).replace(".", ",")}s
        </span>
      </button>

      {open && (
        <>
          <p className="caption" style={{ margin: "6px 0 12px" }}>
            Eine Zeile pro Agent: Balken = Laufzeit, Kerben = einzelne Tool-Calls.
          </p>
          <div className="overflow-x-auto">
            <div className="min-w-[40rem]">
              <div className="relative space-y-[6px]">
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
                    <span className="tl-name">{r.name}</span>
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
                <p className="mono faint-c" style={{ marginTop: 8, fontSize: 11 }}>
                  … {model.hidden} weitere Agenten ausgeblendet
                </p>
              )}
              <div className="relative mt-1 h-4" style={{ marginLeft: LABEL }}>
                {model.gridlines.map((g) => (
                  <span key={g.label} className="tl-axis" style={{ left: `${g.pct}%` }}>
                    {g.label}
                  </span>
                ))}
              </div>
              <div className="legend" style={{ marginTop: 12 }}>
                <span className="legend-label">Balken:</span>
                <span>
                  <i className="legend-swatch legend-swatch-running" /> läuft
                </span>
                <span>
                  <i className="legend-swatch legend-swatch-completed" /> fertig
                </span>
                <span>
                  <i className="legend-swatch legend-swatch-failed" /> gestoppt
                </span>
                <span>
                  <i className="legend-swatch legend-swatch-aborted" /> abgebrochen
                </span>
                <span className="legend-label">Kerben:</span>
                <span>
                  <i className="legend-tick legend-tick-executed" /> Tool ok
                </span>
                <span>
                  <i className="legend-tick legend-tick-rejected" /> abgelehnt
                </span>
                <span>
                  <i className="legend-tick legend-tick-error" /> Tool-Fehler
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
});
