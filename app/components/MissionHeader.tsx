"use client";

import { memo, useEffect, useState } from "react";
import type { RunState } from "@/src/types";
import { formatDuration } from "./derive";
import { num } from "./labels";

const THEME_KEY = "diffusion-dash-theme";

function statusLine(run: RunState): string {
  const agents = Object.values(run.agents);
  const terminal = agents.filter((a) =>
    ["completed", "failed", "aborted"].includes(a.status),
  ).length;
  const running = agents.filter((a) => a.status === "running").length;
  if (run.status === "running") {
    return `Läuft — ${terminal} von ${agents.length} fertig · ${running}/${run.config.concurrency} Slots belegt · ${num(run.budget.used)} Tokens`;
  }
  if (run.status === "completed") {
    return `Fertig in ${formatDuration((run.endedAt ?? run.startedAt) - run.startedAt)} · ${num(run.budget.used)} Tokens · $${run.costUsd.toFixed(4)} — Budget gehalten.`;
  }
  const reason =
    run.stopReason === "kill" ? "Kill-Switch" : run.stopReason === "budget" ? "Budget" : "Fehler";
  return `Gestoppt (${reason}) — „Fortsetzen“ startet nur unfertige Agenten.`;
}

export const MissionHeader = memo(function MissionHeader({
  run,
  onTour,
}: {
  run: RunState | null;
  onTour: () => void;
}) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    if (t === "dark") setTheme("dark");
  }, []);

  const toggleTheme = (): void => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
  };

  return (
    <>
      <header className="masthead">
        <div className="brand">
          <span className="brand-mark" />
          <span className="label">Diffusion · Take-Home</span>
        </div>
        <div className="controls-right">
          <button className="btn btn-ghost" onClick={onTour} aria-label="Produkt-Tour starten">
            ✦ Tour
          </button>
          <button className="btn btn-ghost" onClick={toggleTheme}>
            {theme === "light" ? "Dunkel" : "Hell"}
          </button>
        </div>
      </header>

      <section className="hero">
        <h1>Der Agent, der nicht durchdreht.</h1>
        <p className="hero-sub">
          Quatsch-Items, je ein kleiner Agent mit Mock-Tools. Der Scheduler hält Concurrency, Caps
          und das globale Budget zusammen — egal, was die Agenten vorhaben.
        </p>
        {run && (
          <p className="hero-status mono" data-tour="status">
            <span
              className={run.status === "running" ? "pulse-dot" : "brand-mark"}
              style={
                run.status === "running"
                  ? undefined
                  : {
                      width: 8,
                      height: 8,
                      background:
                        run.status === "completed" ? "var(--accent)" : "var(--warn)",
                    }
              }
            />
            {statusLine(run)}
          </p>
        )}
      </section>
    </>
  );
});
