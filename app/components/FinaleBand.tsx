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

  const mono = "font-mono text-xl font-semibold tabular-nums";
  const items: { label: React.ReactNode; key: string; dot: string; node: React.ReactNode }[] = [
    { key: "invest", label: "invest", dot: "stat-dot-ok", node: <CountUp value={invest} format={(n) => String(Math.round(n))} /> },
    { key: "pass", label: "pass", dot: "stat-dot-dim", node: <CountUp value={pass} format={(n) => String(Math.round(n))} /> },
    { key: "fehler", label: "fehler", dot: "stat-dot-err", node: <span className={mono}>{failed}</span> },
    { key: "gestoppt", label: "gestoppt", dot: "stat-dot-warn", node: <span className={mono}>{aborted}</span> },
    {
      key: "tokens",
      label: `tokens · von ${num(run.budget.limit)}`,
      dot: "stat-dot-accent",
      node: <CountUp value={run.budget.used} format={(n) => num(Math.round(n))} />,
    },
    {
      key: "kosten",
      label: "kosten",
      dot: "stat-dot-accent",
      node: <CountUp value={run.costUsd} format={(n) => `$${n.toFixed(4)}`} />,
    },
    {
      key: "peak",
      label: "max. gleichzeitig",
      dot: "stat-dot-accent",
      node: (
        <span className={mono}>
          {run.concurrencyPeak} / {run.config.concurrency}
        </span>
      ),
    },
    {
      key: "dauer",
      label: "dauer",
      dot: "stat-dot-dim",
      node: <span className={mono}>{formatDuration((run.endedAt ?? Date.now()) - run.startedAt)}</span>,
    },
  ];

  return (
    <section className="glass finale-in mb-4 p-5" data-tour="finale">
      <h2 className="finale-headline">
        {h.pre}
        <em className="accent-serif">{h.em}</em>
        {h.post}
      </h2>
      <p className="panel-sub">
        die bilanz: urteile, verbrauch, parallelität — und ob das budget gehalten hat.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4 lg:grid-cols-8 lg:gap-x-0 lg:divide-x lg:divide-white/[0.06]">
        {items.map((it, i) => (
          <div
            key={it.key}
            className="finale-item lg:px-4 lg:first:pl-0 lg:last:pr-0"
            style={{ "--i": i } as React.CSSProperties}
          >
            {it.node}
            <p className="stat-label">
              <i className={`stat-dot ${it.dot}`} />
              {it.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
});
