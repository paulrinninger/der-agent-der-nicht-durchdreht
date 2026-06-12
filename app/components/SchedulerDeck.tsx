"use client";

import { memo } from "react";
import type { AgentState, RunState } from "@/src/types";
import { num } from "./labels";

/**
 * The hero: the concurrency limit made physical. N bays, agents dock in and
 * out as the worker pool schedules them; the queue and done-stack show the
 * rest of the pipeline state.
 */

const Bay = memo(function Bay({
  index,
  agent,
  maxSteps,
}: {
  index: number;
  agent: AgentState | null;
  maxSteps: number;
}) {
  if (!agent) {
    return (
      <div className="bay flex items-center justify-center">
        <span className="bay-free-label">bay 0{index + 1} · frei</span>
      </div>
    );
  }
  const tokens = agent.usage.inputTokens + agent.usage.outputTokens;
  return (
    <div className="bay bay-occupied p-3">
      {/* keyed by itemId so the dock animation plays once per docking agent */}
      <div key={agent.itemId} className="bay-dock flex h-full flex-col">
        <p className="font-mono text-[10px] tracking-[0.2em] text-accent-soft/70">
          bay 0{index + 1}
        </p>
        <h4 className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug">
          {agent.itemName}
        </h4>
        <p className="shimmer mt-1 truncate font-mono text-[11px]">
          {agent.lastAction ?? "startet…"}
        </p>
        <div className="mt-auto pt-2">
          <div className="bay-stepbar">
            <div style={{ width: `${Math.min(100, (agent.steps / maxSteps) * 100)}%` }} />
          </div>
          <p className="mt-1.5 flex justify-between font-mono text-[10px] text-ink-dim">
            <span>
              step {agent.steps}/{maxSteps}
            </span>
            <span>{num(tokens)} tok</span>
          </p>
        </div>
      </div>
    </div>
  );
});

const QueueRail = memo(function QueueRail({ pending }: { pending: AgentState[] }) {
  return (
    <div className="mt-4" data-tour="queue">
      <p className="font-display text-[10px] uppercase tracking-[0.2em] text-ink-dim">
        warteschlange · {pending.length}
      </p>
      <div className="mt-1.5 flex min-h-[1.75rem] flex-wrap gap-1.5">
        {pending.length === 0 ? (
          <span className="font-mono text-[11px] text-ink-dim/50">leer</span>
        ) : (
          pending.map((a, i) => (
            <span
              key={a.itemId}
              className="puck puck-in max-w-[11rem]"
              style={{ "--i": i } as React.CSSProperties}
              title={a.itemName}
            >
              <span className="text-ink-dim/60">{String(i + 1).padStart(2, "0")}</span>
              <span className="truncate">{a.itemName.toLowerCase()}</span>
            </span>
          ))
        )}
      </div>
    </div>
  );
});

export const SchedulerDeck = memo(function SchedulerDeck({
  run,
  slots,
}: {
  run: RunState;
  slots: (string | null)[];
}) {
  const agents = run.config.items.map((i) => run.agents[i.id]).filter(Boolean);
  const pending = agents.filter((a) => a.status === "pending");
  const done = agents.filter((a) => a.status === "completed").length;
  const failed = agents.filter((a) => a.status === "failed").length;
  const aborted = agents.filter((a) => a.status === "aborted").length;

  return (
    <section className="glass flex min-h-[21rem] flex-col p-5" data-tour="deck">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[11px] uppercase tracking-[0.2em] text-ink-dim">
          scheduler · {run.config.concurrency} slots
          {run.concurrencyPeak > 0 && ` · peak ${run.concurrencyPeak}`}
        </h2>
        <p className="font-mono text-[11px] text-ink-dim">
          <span className="text-ok-soft">✓ {done}</span>
          {" · "}
          <span className={failed > 0 ? "text-err-soft" : ""}>✕ {failed}</span>
          {" · "}
          <span className={aborted > 0 ? "text-warn-soft" : ""}>◼ {aborted}</span>
          <span className="text-ink-dim/60"> / {agents.length}</span>
        </p>
      </div>

      <div
        className="mt-3 grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}
      >
        {slots.map((itemId, i) => (
          <Bay
            key={i}
            index={i}
            agent={itemId ? (run.agents[itemId] ?? null) : null}
            maxSteps={run.config.maxStepsPerAgent}
          />
        ))}
      </div>

      <QueueRail pending={pending} />
    </section>
  );
});
