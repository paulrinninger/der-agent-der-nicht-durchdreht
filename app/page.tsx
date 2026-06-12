"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RunEvent, RunMode, RunState } from "@/src/types";
import { AgentRoster } from "./components/AgentRoster";
import { BudgetCore } from "./components/BudgetCore";
import { ControlsBar } from "./components/ControlsBar";
import { FinaleBand } from "./components/FinaleBand";
import { useBurnSeries, useSlotAssignments, useTicker } from "./components/hooks";
import { MissionHeader } from "./components/MissionHeader";
import { SchedulerDeck } from "./components/SchedulerDeck";
import { Ticker } from "./components/Ticker";
import { TraceDrawer } from "./components/TraceDrawer";

export default function MissionControl() {
  const [run, setRun] = useState<RunState | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [mode, setMode] = useState<RunMode>("mock");
  const [concurrency, setConcurrency] = useState(3);
  const [budget, setBudget] = useState(200_000);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  // rAF coalescing: agent_update storms (~25–40/s in fast mock runs) collapse
  // to one render per frame; snapshots and terminal updates flush immediately.
  const runRef = useRef<RunState | null>(null);
  const pendingRef = useRef<RunState | null>(null);
  const flushRaf = useRef(0);

  const apply = useCallback((next: RunState, urgent: boolean) => {
    runRef.current = next;
    if (urgent) {
      cancelAnimationFrame(flushRaf.current);
      flushRaf.current = 0;
      pendingRef.current = null;
      setRun(next);
      return;
    }
    pendingRef.current = next;
    if (flushRaf.current) return;
    flushRaf.current = requestAnimationFrame(() => {
      flushRaf.current = 0;
      if (pendingRef.current) {
        setRun(pendingRef.current);
        pendingRef.current = null;
      }
    });
  }, []);

  const attach = useCallback(
    (runId: string) => {
      esRef.current?.close();
      const es = new EventSource(`/api/runs/${runId}/events`);
      es.onmessage = (e) => {
        const event: RunEvent = JSON.parse(e.data);
        if (event.type === "snapshot" || event.type === "run_update") {
          apply({ ...event.run }, true);
          if (event.run.status !== "running") es.close();
        } else if (event.type === "agent_update") {
          const base = runRef.current;
          if (!base || base.id !== event.runId) return;
          apply(
            {
              ...base,
              agents: { ...base.agents, [event.agent.itemId]: event.agent },
              budget: event.budget,
              costUsd: event.costUsd,
            },
            false,
          );
        }
      };
      esRef.current = es;
    },
    [apply],
  );

  useEffect(() => {
    fetch("/api/runs")
      .then((r) => r.json())
      .then((d: { runs: RunState[]; hasApiKey: boolean }) => {
        setHasApiKey(d.hasApiKey);
        if (d.runs.length > 0) {
          apply(d.runs[0], true);
          if (d.runs[0].status === "running") attach(d.runs[0].id);
        }
      })
      .catch(() => setError("Server nicht erreichbar."));
    return () => {
      esRef.current?.close();
      cancelAnimationFrame(flushRaf.current);
    };
  }, [attach, apply]);

  const post = async (url: string, body?: unknown): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? `Fehler ${res.status}`);
      else if (data.runId) attach(data.runId);
    } catch {
      setError("Anfrage fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const slots = useSlotAssignments(run);
  const ticker = useTicker(run);
  const burn = useBurnSeries(run);

  const agents = run ? run.config.items.map((i) => run.agents[i.id]).filter(Boolean) : [];
  const isRunning = run?.status === "running";
  const isTerminal = run !== null && run.status !== "running";
  const canResume = run !== null && run.status === "stopped";
  const selectedAgent = selected && run ? run.agents[selected] : null;

  return (
    <main className="mx-auto max-w-[78rem] px-4 py-8 sm:px-6 sm:py-10">
      <MissionHeader run={run} />

      <ControlsBar
        mode={mode}
        onMode={setMode}
        concurrency={concurrency}
        onConcurrency={setConcurrency}
        budget={budget}
        onBudget={setBudget}
        hasApiKey={hasApiKey}
        isRunning={isRunning}
        canResume={canResume}
        busy={busy}
        onStart={() => post("/api/runs", { mode, concurrency, globalTokenBudget: budget })}
        onResume={() => run && post(`/api/runs/${run.id}/resume`)}
        onKill={() => run && post(`/api/runs/${run.id}/kill`)}
      />

      {error && <p className="alert-err mb-4 px-4 py-3 text-sm">{error}</p>}

      {run ? (
        <>
          <div className="mb-4 grid gap-4 lg:grid-cols-12">
            <div className="enter lg:col-span-8" style={{ "--i": 2 } as React.CSSProperties}>
              <SchedulerDeck run={run} slots={slots} />
            </div>
            <div className="enter lg:col-span-4" style={{ "--i": 3 } as React.CSSProperties}>
              <BudgetCore
                budget={run.budget}
                costUsd={run.costUsd}
                series={burn}
                mode={run.config.mode}
                live={isRunning}
              />
            </div>
          </div>

          {isTerminal && <FinaleBand run={run} />}

          <div className="grid items-start gap-4 lg:grid-cols-12">
            <div
              className="enter lg:sticky lg:top-4 lg:col-span-4"
              style={{ "--i": 4 } as React.CSSProperties}
            >
              <Ticker entries={ticker} startedAt={run.startedAt} live={isRunning} />
            </div>
            <div className="lg:col-span-8">
              <AgentRoster
                agents={agents}
                maxSteps={run.config.maxStepsPerAgent}
                onSelect={setSelected}
              />
            </div>
          </div>
        </>
      ) : (
        <section className="glass enter border-dashed p-12 text-center text-ink-dim">
          <p className="text-lg">
            noch <em className="accent-serif">kein</em> lauf.
          </p>
          <p className="mt-2 text-sm">
            „batch starten“ schickt 15 quatsch-startups durch je einen agenten — max. {concurrency}{" "}
            parallel, hartes budget, kill-switch jederzeit. der scheduler oben zeigt live, wer
            gerade in welchem slot arbeitet.
          </p>
        </section>
      )}

      {selectedAgent && <TraceDrawer agent={selectedAgent} onClose={() => setSelected(null)} />}

      <footer className="mt-12 pb-4 text-center text-xs text-ink-dim">
        eval ohne ui &amp; ohne key:{" "}
        <code className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono">
          npm run eval
        </code>{" "}
        — beweist step-cap, budget-invariante, isolation, concurrency-limit, resume.
      </footer>
    </main>
  );
}
