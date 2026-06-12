"use client";

import { memo } from "react";
import type { RunMode } from "@/src/types";
import { KillSwitch } from "./KillSwitch";
import { PRESETS, type PresetDef } from "./presets";

/**
 * Design-Mockup-Layout: Szenario-Tabs links, rechts Limit · Modus ·
 * Items · Start (primary) · Fortsetzen · Kill-Switch. Darunter die Caption
 * des aktiven Szenarios.
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
  const active = PRESETS.find((p) => p.key === preset);

  return (
    <>
      <section className="controls" data-tour="controls">
        <div className="tabs" role="tablist" data-tour="tabs">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              role="tab"
              aria-selected={preset === p.key}
              disabled={isRunning}
              className={"tab" + (preset === p.key ? " active" : "")}
              onClick={() => onPreset(p)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="controls-right">
          <label className="limit-ctl label">
            Limit
            <select
              className="select mono"
              value={concurrency}
              disabled={isRunning}
              data-tip="Wie viele Agenten gleichzeitig arbeiten dürfen — der Rest wartet in der Schlange."
              data-tip-pos="bottom"
              onChange={(e) => onConcurrency(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="limit-ctl label">
            Budget
            <input
              type="number"
              className="input mono"
              style={{ width: 96 }}
              value={budget}
              disabled={isRunning}
              min={1_000}
              step={1_000}
              data-tip="Harte Token-Obergrenze für den gesamten Lauf — wird sie erreicht, stoppt alles."
              data-tip-pos="bottom"
              onChange={(e) => onBudget(Number(e.target.value))}
            />
          </label>
          <div className="seg" role="radiogroup" aria-label="Modus">
            <button
              className={"seg-btn" + (mode === "mock" ? " active" : "")}
              disabled={isRunning}
              data-tip="Simulierter Lauf mit deterministischen Fake-Antworten — kostet nichts."
              data-tip-pos="bottom"
              onClick={() => onMode("mock")}
            >
              Demo ($0)
            </button>
            <button
              className={"seg-btn" + (mode === "anthropic" ? " active" : "")}
              disabled={isRunning || !hasApiKey}
              data-tip={
                hasApiKey
                  ? "Echte KI-Calls über Claude Haiku — kostet pro Lauf ein paar Cent."
                  : "Kein ANTHROPIC_API_KEY in .env — der Demo-Modus bleibt voll nutzbar."
              }
              data-tip-pos="bottom"
              onClick={() => onMode("anthropic")}
            >
              Claude Haiku
            </button>
          </div>
          <button
            className="btn btn-ghost"
            onClick={onOpenItems}
            data-tip="Eigene Ideen anlegen, löschen oder per KI erfinden lassen."
            data-tip-pos="bottom"
          >
            ✎ Items · {itemCount}
          </button>
          {canResume && (
            <button
              className="btn"
              disabled={busy}
              data-tip="Startet nur die unfertigen Agenten neu — fertige werden nicht doppelt bezahlt."
              data-tip-pos="bottom"
              onClick={onResume}
            >
              ↻ Fortsetzen
            </button>
          )}
          {isRunning ? (
            <KillSwitch onKill={onKill} disabled={busy} />
          ) : (
            <button className="btn btn-primary" disabled={busy} onClick={onStart}>
              Batch starten
            </button>
          )}
        </div>
      </section>

      <p className="caption">
        {active
          ? active.hint
          : "Eigene Einstellungen — Limit, Budget und Items frei gewählt. Die Caps und das globale Budget gelten trotzdem, immer."}
      </p>
    </>
  );
});
