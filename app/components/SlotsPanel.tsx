"use client";

import { memo } from "react";
import type { RunState } from "@/src/types";
import { num } from "./labels";

/**
 * Das Concurrency-Limit physisch sichtbar (zurückgeholt aus dem Mission-
 * Control, übersetzt in die Hairline-Sprache): N Slots, Agenten docken live
 * an und ab, darunter wartet die Schlange.
 */
export const SlotsPanel = memo(function SlotsPanel({
  run,
  slots,
}: {
  run: RunState;
  slots: (string | null)[];
}) {
  const agents = run.config.items.map((i) => run.agents[i.id]).filter(Boolean);
  const pending = agents.filter((a) => a.status === "pending");
  const shown = pending.slice(0, 12);

  return (
    <section className="slots-panel" data-tour="slots">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span
          className="label"
          data-tip="Mehr Agenten arbeiten nie gleichzeitig — wer keinen Slot hat, wartet unten in der Schlange."
        >
          Slots · Limit {run.config.concurrency}
          {run.concurrencyPeak > 0 ? ` · Peak ${run.concurrencyPeak}` : ""}
        </span>
        <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
          Warteschlange · {pending.length}
        </span>
      </div>

      <div className="slots-grid">
        {slots.map((itemId, i) => {
          const a = itemId ? run.agents[itemId] : null;
          if (!a) {
            return (
              <div key={i} className="slot slot-free">
                <span className="mono">Slot 0{i + 1} · frei</span>
              </div>
            );
          }
          const tokens = a.usage.inputTokens + a.usage.outputTokens;
          return (
            <div key={i} className="slot slot-busy">
              {/* keyed by itemId: dock animation plays once per docking agent */}
              <div key={a.itemId} className="slot-dock" style={{ minWidth: 0 }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="slot-name">{a.itemName}</span>
                  <span className="pulse-dot" style={{ flexShrink: 0 }} />
                </div>
                <p className="slot-line mono">{a.lastAction ?? "startet…"}</p>
                <p className="slot-line mono">
                  {a.steps}/{run.config.maxStepsPerAgent} Steps ·{" "}
                  <span key={tokens} className="blip-num">
                    {num(tokens)} Tok
                  </span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="queue-row">
        {pending.length === 0 ? (
          <span className="mono faint-c" style={{ fontSize: 11.5 }}>
            Warteschlange leer
          </span>
        ) : (
          <>
            {shown.map((a, i) => (
              <span key={a.itemId} className="queue-chip" title={a.itemName}>
                <span className="mono faint-c">{String(i + 1).padStart(2, "0")}</span>
                <span>{a.itemName}</span>
              </span>
            ))}
            {pending.length > shown.length && (
              <span className="mono faint-c" style={{ fontSize: 11.5 }}>
                +{pending.length - shown.length} weitere
              </span>
            )}
          </>
        )}
      </div>
    </section>
  );
});
