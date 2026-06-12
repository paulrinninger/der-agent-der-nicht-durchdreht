"use client";

import { memo } from "react";
import type { BudgetSnapshot, RunMode } from "@/src/types";
import { Gauge } from "./Gauge";
import type { BurnPoint } from "./hooks";
import { num } from "./labels";
import { Odometer } from "./Odometer";
import { Sparkline } from "./Sparkline";

export const BudgetCore = memo(function BudgetCore({
  budget,
  costUsd,
  series,
  mode,
  live,
}: {
  budget: BudgetSnapshot;
  costUsd: number;
  series: BurnPoint[];
  mode: RunMode;
  live: boolean;
}) {
  const pct = (n: number) => (budget.limit > 0 ? (n / budget.limit) * 100 : 0);

  return (
    <section className="glass flex min-h-[21rem] flex-col p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-[11px] uppercase tracking-[0.2em] text-ink-dim">
          budget-kern
        </h2>
        <span className="font-mono text-[11px] text-ink-dim">
          {mode === "mock" ? "simuliert" : "claude-haiku-4-5"}
        </span>
      </div>

      <div className="relative mx-auto mt-1 w-full max-w-[230px]">
        <Gauge
          usedPct={Math.round(pct(budget.used) * 10) / 10}
          reservedPct={Math.round(pct(budget.reserved) * 10) / 10}
          peakPct={Math.round(pct(budget.peak) * 10) / 10}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <Odometer
            value={budget.used}
            format={(n) => num(Math.round(n))}
            className="font-mono text-3xl font-semibold leading-none"
          />
          <p className="mt-1 font-mono text-[11px] text-ink-dim">von {num(budget.limit)} tokens</p>
          <Odometer
            value={costUsd}
            format={(n) => `$${n.toFixed(4)}`}
            className="mt-2 font-mono text-base text-accent-soft"
          />
        </div>
      </div>

      <div className="mt-auto">
        <Sparkline series={series} live={live} />
        <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-ink-dim">
          <span className="text-accent-soft">━</span> verbraucht ·{" "}
          <span className="text-accent-soft">▨</span> reserviert (in-flight) ·{" "}
          <span className="text-warn-soft">|</span> peak {num(budget.peak)}
        </p>
      </div>
    </section>
  );
});
