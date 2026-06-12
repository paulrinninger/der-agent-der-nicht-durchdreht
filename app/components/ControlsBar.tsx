"use client";

import { memo } from "react";
import type { RunMode } from "@/src/types";
import { KillSwitch } from "./KillSwitch";
import { PRESETS, type PresetDef } from "./presets";

/**
 * Two deliberate rows on one flush line ("was läuft" / "wie es läuft"),
 * hairline between them; the action zone spans both rows on the right and
 * never wraps alone.
 */
export const ControlsBar = memo(function ControlsBar({
  mode,
  onMode,
  concurrency,
  onConcurrency,
  budget,
  onBudget,
  preset,
  onPreset,
  itemCount,
  onOpenItems,
  hasApiKey,
  isRunning,
  canResume,
  busy,
  onStart,
  onResume,
  onKill,
}: {
  mode: RunMode;
  onMode: (m: RunMode) => void;
  concurrency: number;
  onConcurrency: (n: number) => void;
  budget: number;
  onBudget: (n: number) => void;
  preset: PresetDef["key"] | null;
  onPreset: (p: PresetDef) => void;
  itemCount: number;
  onOpenItems: () => void;
  hasApiKey: boolean;
  isRunning: boolean;
  canResume: boolean;
  busy: boolean;
  onStart: () => void;
  onResume: () => void;
  onKill: () => void;
}) {
  return (
    <section className="glass glass-blur enter mb-4 p-4 sm:p-5" data-tour="controls">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="space-y-3">
          {/* row 1: WAS läuft */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="ctrl-label">was läuft</span>
            {PRESETS.map((p) => (
              <button
                key={p.key}
                disabled={isRunning}
                onClick={() => onPreset(p)}
                data-tip={p.hint}
                data-tip-pos="bottom"
                className={`puck cursor-pointer transition-colors ${
                  preset === p.key ? "border-accent/40 text-ink" : "hover:text-ink"
                }`}
              >
                {p.label}
                <span className={`puck-tag ${p.tagClass}`}>{p.tag}</span>
              </button>
            ))}
            <button
              onClick={onOpenItems}
              data-tip="öffnet den editor: eigene ideen anlegen, löschen oder per ki erfinden lassen."
              data-tip-pos="bottom"
              className="puck h-7 cursor-pointer hover:text-ink"
            >
              ✎ items · {itemCount}
            </button>
          </div>

          <div className="h-px bg-white/[0.06]" aria-hidden />

          {/* row 2: WIE es läuft */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="ctrl-label">wie es läuft</span>
            <div className="flex items-center gap-2">
              <span className="ctrl-field-label">modus</span>
              <div className="seg">
                <button
                  onClick={() => onMode("mock")}
                  disabled={isRunning}
                  data-tip="simulierter lauf mit deterministischen fake-antworten — kostet nichts, perfekt zum ausprobieren."
                  data-tip-pos="bottom"
                  className={`seg-item ${mode === "mock" ? "seg-item-active" : ""}`}
                >
                  demo ($0)
                </button>
                <button
                  onClick={() => onMode("anthropic")}
                  disabled={isRunning || !hasApiKey}
                  data-tip={
                    hasApiKey
                      ? "echte ki-calls über claude haiku — kostet pro lauf ein paar cent."
                      : "kein ANTHROPIC_API_KEY in .env — der demo-modus bleibt voll nutzbar."
                  }
                  data-tip-pos="bottom"
                  className={`seg-item ${mode === "anthropic" ? "seg-item-active" : ""}`}
                >
                  claude haiku
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="ctrl-field-label" htmlFor="ctrl-par">
                parallel
              </label>
              <select
                id="ctrl-par"
                value={concurrency}
                disabled={isRunning}
                data-tip="wie viele agenten gleichzeitig arbeiten dürfen — der rest wartet in der schlange."
                data-tip-pos="bottom"
                onChange={(e) => onConcurrency(Number(e.target.value))}
                className="field text-sm"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="ctrl-field-label" htmlFor="ctrl-bud">
                budget
              </label>
              <input
                id="ctrl-bud"
                type="number"
                value={budget}
                disabled={isRunning}
                min={1_000}
                step={1_000}
                data-tip="harte obergrenze für den gesamten lauf. wird sie erreicht, stoppt alles — garantiert."
                data-tip-pos="bottom"
                onChange={(e) => onBudget(Number(e.target.value))}
                className="field w-28 font-mono text-sm"
              />
              <span className="font-mono text-[11px] text-ink-dim">tokens</span>
            </div>
          </div>
        </div>

        {/* action zone: spans both rows, vertically centered, never wraps alone */}
        <div className="flex items-center gap-2 lg:border-l lg:border-white/[0.06] lg:pl-4">
          {canResume && (
            <button
              onClick={onResume}
              disabled={busy}
              data-tip="startet nur die unfertigen agenten neu — fertige werden nicht doppelt bezahlt."
              className="btn btn-warn w-full lg:w-auto"
            >
              ↻ fortsetzen
            </button>
          )}
          {isRunning ? (
            <KillSwitch onKill={onKill} disabled={busy} />
          ) : (
            <button onClick={onStart} disabled={busy} className="btn btn-positive w-full lg:w-auto">
              ▶ lauf starten
            </button>
          )}
        </div>
      </div>
    </section>
  );
});
