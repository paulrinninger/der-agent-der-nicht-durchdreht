"use client";

import { memo } from "react";
import type { RunState } from "@/src/types";
import { formatDuration } from "./derive";
import { num } from "./labels";

function statusLine(run: RunState | null): string {
  if (!run) return "bereit. 15 quatsch-startups, je ein agent — der scheduler hält sie im zaum.";
  const agents = Object.values(run.agents);
  const terminal = agents.filter((a) =>
    ["completed", "failed", "aborted"].includes(a.status),
  ).length;
  const running = agents.filter((a) => a.status === "running").length;
  if (run.status === "running") {
    return `läuft — ${terminal} von ${agents.length} · slot-auslastung ${running}/${run.config.concurrency} · ${num(run.budget.used)} tokens`;
  }
  if (run.status === "completed") {
    return `fertig in ${formatDuration((run.endedAt ?? run.startedAt) - run.startedAt)} · ${num(run.budget.used)} tokens · $${run.costUsd.toFixed(4)}`;
  }
  const reason =
    run.stopReason === "kill" ? "kill-switch" : run.stopReason === "budget" ? "budget" : "fehler";
  return `gestoppt (${reason}) — fortsetzen möglich, fertige agenten werden nicht doppelt bezahlt.`;
}

export const MissionHeader = memo(function MissionHeader({ run }: { run: RunState | null }) {
  return (
    <header className="enter mb-7">
      <h1 className="font-display text-3xl font-bold lowercase tracking-tight sm:text-4xl">
        der agent, der <em className="accent-serif">nicht durchdreht</em>
        <span className="text-accent">.</span>
      </h1>
      <p className="mt-2 font-mono text-xs text-ink-dim sm:text-sm">{statusLine(run)}</p>
    </header>
  );
});
