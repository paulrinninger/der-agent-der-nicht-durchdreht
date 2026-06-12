"use client";

import { memo } from "react";
import type { BudgetSnapshot, RunMode } from "@/src/types";
import { Gauge } from "./Gauge";
import type { BurnPoint } from "./hooks";
import { num } from "./labels";
import { Odometer } from "./Odometer";
import { PanelHeader } from "./PanelHeader";
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
      <PanelHeader
        title="budget-kern"
        sub="ein token-vorrat für alle agenten — jeder ki-call reserviert erst, dann wird abgerechnet."
        meta={
          <span data-tip={mode === "mock" ? "zahlen aus dem simulator — gleiche mechanik, null kosten." : undefined}>
            {mode === "mock" ? "demo-daten" : "claude-haiku-4-5"}
          </span>
        }
      />

      <div className="relative mx-auto mt-1 w-full max-w-[230px]" data-tour="gauge">
        {/* keyed remount replays a 600ms pulse whenever ~500 tokens commit —
            deliberately NOT keying the Gauge itself (would reset transitions) */}
        <div
          key={Math.round(budget.used / 500)}
          className="gauge-blip pointer-events-none absolute inset-4 rounded-full"
          aria-hidden
        />
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
        <p className="legend mt-1.5">
          <span data-tip="tokens, die nach abgeschlossenen calls fest verbucht sind.">
            <span className="text-accent-soft">━</span> verbraucht
          </span>
          <span data-tip="vor jedem ki-call zur seite gelegt — so können parallele agenten das budget nie gemeinsam reißen.">
            <span className="text-accent-soft">▨</span> reserviert (laufende calls)
          </span>
          <span data-tip="höchster stand von verbraucht + reserviert. bleibt er unterm limit, hat die invariante gehalten.">
            <span className="text-warn-soft">|</span> peak {num(budget.peak)}
          </span>
        </p>
      </div>
    </section>
  );
});
