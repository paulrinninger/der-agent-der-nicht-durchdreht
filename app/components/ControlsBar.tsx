"use client";

import { memo } from "react";
import type { RunMode } from "@/src/types";
import { KillSwitch } from "./KillSwitch";

const PRESETS = [
  { key: "standard", label: "standard", budget: 200_000, concurrency: 3 },
  { key: "crunch", label: "budget-crunch", budget: 10_000, concurrency: 3 },
] as const;

export const ControlsBar = memo(function ControlsBar({
  mode,
  onMode,
  concurrency,
  onConcurrency,
  budget,
  onBudget,
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
  hasApiKey: boolean;
  isRunning: boolean;
  canResume: boolean;
  busy: boolean;
  onStart: () => void;
  onResume: () => void;
  onKill: () => void;
}) {
  return (
    <section
      className="glass glass-blur enter mb-6 flex flex-wrap items-end gap-x-5 gap-y-4 p-4 sm:p-5"
      data-tour="controls"
    >
      <div>
        <label className="font-display mb-1.5 block text-[11px] uppercase tracking-[0.15em] text-ink-dim">
          preset
        </label>
        <div className="flex gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              disabled={isRunning}
              onClick={() => {
                onBudget(p.budget);
                onConcurrency(p.concurrency);
              }}
              className={`puck transition-colors ${
                budget === p.budget ? "border-accent/40 text-accent-soft" : "hover:text-ink"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="font-display mb-1.5 block text-[11px] uppercase tracking-[0.15em] text-ink-dim">
          modus
        </label>
        <div className="seg">
          <button
            onClick={() => onMode("mock")}
            disabled={isRunning}
            className={`seg-item ${mode === "mock" ? "seg-item-active" : ""}`}
          >
            mock ($0)
          </button>
          <button
            onClick={() => onMode("anthropic")}
            disabled={isRunning || !hasApiKey}
            title={hasApiKey ? "claude-haiku-4-5" : "Kein ANTHROPIC_API_KEY in .env — Mock-Modus verfügbar"}
            className={`seg-item ${mode === "anthropic" ? "seg-item-active" : ""}`}
          >
            claude haiku
          </button>
        </div>
      </div>
      <div>
        <label className="font-display mb-1.5 block text-[11px] uppercase tracking-[0.15em] text-ink-dim">
          parallel
        </label>
        <select
          value={concurrency}
          disabled={isRunning}
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
      <div>
        <label className="font-display mb-1.5 block text-[11px] uppercase tracking-[0.15em] text-ink-dim">
          token-budget
        </label>
        <input
          type="number"
          value={budget}
          disabled={isRunning}
          min={1_000}
          step={1_000}
          onChange={(e) => onBudget(Number(e.target.value))}
          className="field w-32 font-mono text-sm"
        />
      </div>
      <div className="ml-auto flex gap-2">
        {canResume && (
          <button onClick={onResume} disabled={busy} className="btn btn-warn">
            ↻ fortsetzen
          </button>
        )}
        {isRunning ? (
          <KillSwitch onKill={onKill} disabled={busy} />
        ) : (
          <button onClick={onStart} disabled={busy} className="btn btn-positive">
            ▶ batch starten
          </button>
        )}
      </div>
    </section>
  );
});
