"use client";

import { memo } from "react";
import type { RunState } from "@/src/types";
import { parseVerdict } from "./derive";
import { useOdometer } from "./hooks";
import { num } from "./labels";

/** Stat-Zahl mit Count-up (rAF-eased, snapped bei reduced motion) */
function StatNum({ value }: { value: number }) {
  const d = useOdometer(value);
  return <>{Math.round(d)}</>;
}

function BudgetBar({ run }: { run: RunState }) {
  const { used, reserved, peak, limit } = run.budget;
  const usedPct = Math.min(100, (used / limit) * 100);
  const reservedPct = Math.min(100 - usedPct, (reserved / limit) * 100);
  const peakPct = Math.min(100, (peak / limit) * 100);
  const warnLevel = usedPct + reservedPct > 85;

  return (
    <div className="budget" data-tour="budget">
      <div className="budget-head">
        <span
          className="label"
          data-tip="Harte Obergrenze für den ganzen Lauf. Jeder KI-Call reserviert erst (schraffiert), dann wird abgerechnet — verbraucht + reserviert bleibt immer unterm Limit."
        >
          Globales Token-Budget
        </span>
        <span className="mono budget-num">
          {num(used)}
          {reserved > 0 ? ` (+${num(reserved)} reserviert)` : ""} / {num(limit)}
        </span>
      </div>
      <div className="budget-track">
        <div
          className={"budget-fill" + (warnLevel ? " warn-fill" : "")}
          style={{ width: usedPct + "%" }}
        />
        {reservedPct > 0.3 && (
          <div
            className="budget-reserved"
            style={{ left: usedPct + "%", width: reservedPct + "%" }}
          />
        )}
        {peakPct > 0.5 && (
          <div
            className="budget-peak"
            style={{ left: peakPct + "%" }}
            data-tip="Höchster Stand von verbraucht + reserviert — bleibt er unterm Limit, hat die Invariante gehalten."
          />
        )}
      </div>
    </div>
  );
}

export const StatsBar = memo(function StatsBar({ run }: { run: RunState }) {
  const agents = run.config.items.map((i) => run.agents[i.id]).filter(Boolean);
  const count = (s: string) => agents.filter((a) => a.status === s).length;
  const running = count("running");
  const queued = count("pending");
  const done = count("completed");
  const stopped = count("failed");
  const killed = count("aborted");
  const invest = agents.filter((a) => parseVerdict(a.result) === "invest").length;
  const pass = agents.filter((a) => parseVerdict(a.result) === "pass").length;
  const cost = useOdometer(run.costUsd);

  return (
    <div className="stats" data-tour="stats">
      <div className="stat">
        <span className="stat-num mono">
          {running}
          <span className="stat-dim"> / {run.config.concurrency}</span>
        </span>
        <span className="label">Aktiv / Limit</span>
      </div>
      <div className="stat">
        <span className="stat-num mono">
          <StatNum value={queued} />
        </span>
        <span className="label">Warteschlange</span>
      </div>
      <div className="stat">
        <span className="stat-num mono accent">
          <StatNum value={done} />
          <span className="stat-dim"> / {agents.length}</span>
        </span>
        <span className="label">Fertig</span>
      </div>
      <div className="stat" data-tip="Live-Bilanz der Urteile: Der Agent würde investieren / winkt ab.">
        <span className="stat-num mono">
          <span className="accent">
            <StatNum value={invest} />
          </span>
          <span className="stat-dim"> / </span>
          <StatNum value={pass} />
        </span>
        <span className="label">Invest / Pass</span>
      </div>
      <div className="stat">
        <span className={"stat-num mono" + (stopped ? " warn" : "")}>
          <StatNum value={stopped} />
        </span>
        <span className="label">Gestoppt</span>
      </div>
      <div className="stat">
        <span className={"stat-num mono" + (killed ? " danger" : "")}>
          <StatNum value={killed} />
        </span>
        <span className="label">Abgebrochen</span>
      </div>
      <div className="stat">
        <span className="stat-num mono">${cost.toFixed(4)}</span>
        <span className="label">Kosten {run.config.mode === "mock" ? "(simuliert)" : "(Haiku)"}</span>
      </div>
      <div className="stat stat-budget">
        <BudgetBar run={run} />
      </div>
    </div>
  );
});
