"use client";

import { memo } from "react";
import type { RunState } from "@/src/types";
import { formatDuration } from "./derive";
import { num } from "./labels";

function statusLine(run: RunState): string {
  const agents = Object.values(run.agents);
  const terminal = agents.filter((a) =>
    ["completed", "failed", "aborted"].includes(a.status),
  ).length;
  const running = agents.filter((a) => a.status === "running").length;
  if (run.status === "running") {
    return `läuft — ${terminal} von ${agents.length} fertig · ${running}/${run.config.concurrency} slots belegt · ${num(run.budget.used)} tokens verbraucht`;
  }
  if (run.status === "completed") {
    return `fertig in ${formatDuration((run.endedAt ?? run.startedAt) - run.startedAt)} · ${num(run.budget.used)} tokens · $${run.costUsd.toFixed(4)} — budget gehalten.`;
  }
  const reason =
    run.stopReason === "kill" ? "kill-switch" : run.stopReason === "budget" ? "budget" : "fehler";
  return `gestoppt (${reason}) — „fortsetzen“ startet nur unfertige agenten, fertige werden nicht doppelt bezahlt.`;
}

export const MissionHeader = memo(function MissionHeader({
  run,
  onTour,
}: {
  run: RunState | null;
  onTour: () => void;
}) {
  return (
    <header className="enter relative mb-7">
      <button
        onClick={onTour}
        aria-label="produkt-tour starten"
        className="puck absolute right-0 top-1 cursor-pointer transition-colors hover:text-ink"
      >
        ✦ tour
      </button>
      <h1 className="font-display pr-20 text-3xl font-bold lowercase tracking-tight sm:text-4xl">
        der agent, der <em className="accent-serif">nicht durchdreht</em>
        <span className="text-accent">.</span>
      </h1>
      {/* permanent explainer — never disappears */}
      <p className="mt-2 max-w-[44rem] text-sm leading-relaxed text-ink-dim">
        15 quatsch-startups, je ein ki-agent, der sie bewertet — ein scheduler hält parallelität,
        schritte und token-budget hart im zaum.
      </p>
      {/* status only when a run exists, with a status dot */}
      {run && (
        <p className="mt-1.5 flex items-center gap-1.5 font-mono text-xs text-ink-dim">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              run.status === "running"
                ? "pipe-dot pipe-dot-active"
                : run.status === "completed"
                  ? "bg-ok"
                  : "bg-warn"
            }`}
          />
          {statusLine(run)}
        </p>
      )}
    </header>
  );
});
