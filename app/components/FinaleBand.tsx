"use client";

import { memo, useEffect, useState } from "react";
import type { RunState } from "@/src/types";
import { formatDuration, parseVerdict } from "./derive";
import { useOdometer } from "./hooks";
import { num } from "./labels";

/** one-shot count-up: mounts at 0, eases to the value */
function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const [target, setTarget] = useState(0);
  useEffect(() => setTarget(value), [value]);
  const display = useOdometer(target, 900);
  return <span className="font-mono text-xl font-semibold tabular-nums">{format(display)}</span>;
}

function headline(run: RunState): { pre: string; em: string; post: string } {
  if (run.status === "completed") return { pre: "lauf ", em: "kontrolliert", post: " beendet." };
  if (run.stopReason === "kill") return { pre: "lauf ", em: "manuell", post: " gestoppt." };
  if (run.stopReason === "budget") return { pre: "lauf ", em: "am budget", post: " gestoppt." };
  return { pre: "lauf ", em: "mit fehler", post: " gestoppt." };
}

export const FinaleBand = memo(function FinaleBand({ run }: { run: RunState }) {
  const agents = Object.values(run.agents);
  const invest = agents.filter((a) => parseVerdict(a.result) === "invest").length;
  const pass = agents.filter((a) => parseVerdict(a.result) === "pass").length;
  const failed = agents.filter((a) => a.status === "failed").length;
  const aborted = agents.filter((a) => a.status === "aborted").length;
  const h = headline(run);

  const items: { label: string; node: React.ReactNode }[] = [
    { label: "invest", node: <CountUp value={invest} format={(n) => String(Math.round(n))} /> },
    { label: "pass", node: <CountUp value={pass} format={(n) => String(Math.round(n))} /> },
    {
      label: "fehler · gestoppt",
      node: (
        <span className="font-mono text-xl font-semibold tabular-nums">
          {failed} · {aborted}
        </span>
      ),
    },
    {
      label: `tokens von ${num(run.budget.limit)}`,
      node: <CountUp value={run.budget.used} format={(n) => num(Math.round(n))} />,
    },
    { label: "kosten", node: <CountUp value={run.costUsd} format={(n) => `$${n.toFixed(4)}`} /> },
    {
      label: "peak-parallelität",
      node: (
        <span className="font-mono text-xl font-semibold tabular-nums">
          {run.concurrencyPeak} / {run.config.concurrency}
        </span>
      ),
    },
    {
      label: "dauer",
      node: (
        <span className="font-mono text-xl font-semibold tabular-nums">
          {formatDuration((run.endedAt ?? Date.now()) - run.startedAt)}
        </span>
      ),
    },
  ];

  return (
    <section className="glass finale-in mb-4 p-5 sm:p-6">
      <h2 className="finale-headline">
        {h.pre}
        <em className="accent-serif">{h.em}</em>
        {h.post}
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4 lg:grid-cols-7">
        {items.map((it, i) => (
          <div key={it.label} className="finale-item" style={{ "--i": i } as React.CSSProperties}>
            {it.node}
            <p className="mt-0.5 font-display text-[10px] uppercase tracking-[0.15em] text-ink-dim">
              {it.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
});
