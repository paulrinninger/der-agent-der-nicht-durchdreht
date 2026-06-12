"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentState, EndReason, ItemStatus, RunEvent, RunState, TraceEntry } from "@/src/types";

// ---------- labels & styles ----------

const STATUS_LABEL: Record<ItemStatus, string> = {
  pending: "wartet",
  running: "läuft",
  completed: "fertig",
  failed: "Fehler",
  aborted: "gestoppt",
};

const STATUS_CHIP: Record<ItemStatus, string> = {
  pending: "chip chip-pending",
  running: "chip chip-running",
  completed: "chip chip-completed",
  failed: "chip chip-failed",
  aborted: "chip chip-aborted",
};

const END_REASON_LABEL: Record<EndReason, string> = {
  finalized: "finalize",
  step_cap: "Step-Cap",
  token_cap: "Token-Cap",
  strikes: "3 Strikes",
  no_finalize: "kein finalize",
  error: "LLM-Fehler",
  killed: "Kill-Switch",
  global_budget: "Budget",
};

const TRACE_ICON: Record<TraceEntry["kind"], string> = {
  llm_call: "🧠",
  tool_executed: "🔧",
  tool_rejected: "⛔",
  tool_error: "⚠️",
  reminder: "🔁",
  terminal: "⏹",
};

const num = (n: number) => n.toLocaleString("de-DE");

// ---------- page ----------

export default function Dashboard() {
  const [run, setRun] = useState<RunState | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [mode, setMode] = useState<"mock" | "anthropic">("mock");
  const [concurrency, setConcurrency] = useState(3);
  const [budget, setBudget] = useState(200_000);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const attach = useCallback((runId: string) => {
    esRef.current?.close();
    const es = new EventSource(`/api/runs/${runId}/events`);
    es.onmessage = (e) => {
      const event: RunEvent = JSON.parse(e.data);
      if (event.type === "snapshot" || event.type === "run_update") {
        setRun({ ...event.run });
        if (event.run.status !== "running") es.close();
      } else if (event.type === "agent_update") {
        setRun((prev) =>
          prev && prev.id === event.runId
            ? {
                ...prev,
                agents: { ...prev.agents, [event.agent.itemId]: event.agent },
                budget: event.budget,
                costUsd: event.costUsd,
              }
            : prev,
        );
      }
    };
    esRef.current = es;
  }, []);

  useEffect(() => {
    fetch("/api/runs")
      .then((r) => r.json())
      .then((d: { runs: RunState[]; hasApiKey: boolean }) => {
        setHasApiKey(d.hasApiKey);
        if (d.runs.length > 0) {
          setRun(d.runs[0]);
          if (d.runs[0].status === "running") attach(d.runs[0].id);
        }
      })
      .catch(() => setError("Server nicht erreichbar."));
    return () => esRef.current?.close();
  }, [attach]);

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

  const agents = run ? run.config.items.map((i) => run.agents[i.id]).filter(Boolean) : [];
  const count = (s: ItemStatus) => agents.filter((a) => a.status === s).length;
  const isRunning = run?.status === "running";
  const canResume = run !== null && run.status === "stopped";
  const selectedAgent = selected && run ? run.agents[selected] : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {/* header */}
      <header className="mb-8">
        <h1 className="display-title text-3xl font-bold sm:text-4xl">
          der agent, der nicht durchdreht<span className="text-accent">.</span>
        </h1>
        <p className="mt-2 text-sm text-ink-dim">
          15 Quatsch-Startups · je ein Agent mit Tools · Concurrency-Limit, Tool-Call-Validierung,
          Step-/Budget-Caps, globaler Kill-Switch
        </p>
      </header>

      {/* controls */}
      <section className="glass glass-blur mb-6 flex flex-wrap items-end gap-4 p-4 sm:p-5">
        <div>
          <label className="font-display mb-1.5 block text-xs text-ink-dim">Modus</label>
          <div className="seg">
            <button
              onClick={() => setMode("mock")}
              disabled={isRunning}
              className={`seg-item ${mode === "mock" ? "seg-item-active" : ""}`}
            >
              Mock ($0)
            </button>
            <button
              onClick={() => setMode("anthropic")}
              disabled={isRunning || !hasApiKey}
              title={hasApiKey ? "claude-haiku-4-5" : "Kein ANTHROPIC_API_KEY in .env — Mock-Modus verfügbar"}
              className={`seg-item ${mode === "anthropic" ? "seg-item-active" : ""}`}
            >
              Claude Haiku
            </button>
          </div>
        </div>
        <div>
          <label className="font-display mb-1.5 block text-xs text-ink-dim">Parallel (max)</label>
          <select
            value={concurrency}
            disabled={isRunning}
            onChange={(e) => setConcurrency(Number(e.target.value))}
            className="field text-sm"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="font-display mb-1.5 block text-xs text-ink-dim">Token-Budget (global)</label>
          <input
            type="number"
            value={budget}
            disabled={isRunning}
            min={1_000}
            step={1_000}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="field w-32 font-mono text-sm"
          />
        </div>
        <div className="ml-auto flex gap-2">
          {canResume && (
            <button onClick={() => post(`/api/runs/${run.id}/resume`)} disabled={busy} className="btn btn-warn">
              ↻ Fortsetzen
            </button>
          )}
          {isRunning ? (
            <button onClick={() => post(`/api/runs/${run.id}/kill`)} disabled={busy} className="btn btn-destructive">
              ■ Kill-Switch
            </button>
          ) : (
            <button
              onClick={() => post("/api/runs", { mode, concurrency, globalTokenBudget: budget })}
              disabled={busy}
              className="btn btn-positive"
            >
              ▶ Batch starten
            </button>
          )}
        </div>
      </section>

      {error && <p className="alert-err mb-4 px-4 py-3 text-sm">{error}</p>}

      {run ? (
        <>
          {/* stats */}
          <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Status" index={0}>
              <span className={isRunning ? "text-accent" : run.status === "completed" ? "text-ok" : "text-warn"}>
                {run.status === "running" ? "AKTIV" : run.status === "completed" ? "FERTIG" : "GESTOPPT"}
                {run.stopReason ? ` (${run.stopReason === "budget" ? "Budget" : run.stopReason === "kill" ? "Kill" : "Fatal"})` : ""}
              </span>
            </Stat>
            <Stat label={`Aktiv / Limit ${run.config.concurrency}`} index={1}>
              {count("running")}
              <span className="text-ink-dim"> · Peak {run.concurrencyPeak}</span>
            </Stat>
            <Stat label="Fertig" index={2}>
              <span className="text-ok">{count("completed")}</span>
              <span className="text-ink-dim"> / {agents.length}</span>
            </Stat>
            <Stat label="Fehler / Gestoppt" index={3}>
              <span className="text-err">{count("failed")}</span>
              <span className="text-ink-dim"> / </span>
              <span className="text-warn">{count("aborted")}</span>
            </Stat>
            <Stat label="Tokens" index={4}>
              {num(run.budget.used)}
              <span className="text-ink-dim"> / {num(run.budget.limit)}</span>
            </Stat>
            <Stat label={`Kosten (${run.config.mode === "mock" ? "simuliert" : "Haiku"})`} index={5}>
              ${run.costUsd.toFixed(4)}
            </Stat>
          </section>

          {/* budget bar */}
          <section className="mb-6">
            <div className="bar-track">
              <div
                className="bar-used"
                style={{ width: `${Math.min(100, (run.budget.used / run.budget.limit) * 100)}%` }}
              />
              <div
                className="bar-reserved"
                style={{ width: `${Math.min(100, (run.budget.reserved / run.budget.limit) * 100)}%` }}
                title="reserviert für laufende Calls"
              />
            </div>
            <p className="mt-1.5 font-mono text-xs text-ink-dim">
              verbraucht {num(run.budget.used)} · reserviert {num(run.budget.reserved)} · Peak{" "}
              {num(run.budget.peak)} / {num(run.budget.limit)}
            </p>
          </section>

          {/* agent cards */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((a, i) => (
              <AgentCard
                key={a.itemId}
                agent={a}
                index={i}
                maxSteps={run.config.maxStepsPerAgent}
                onClick={() => setSelected(a.itemId)}
              />
            ))}
          </section>
        </>
      ) : (
        <section className="glass border-dashed p-12 text-center text-ink-dim">
          <p className="text-lg">Noch kein Lauf.</p>
          <p className="mt-1 text-sm">
            „Batch starten“ schickt 15 Quatsch-Startups durch je einen Agenten — max.{" "}
            {concurrency} parallel, hartes Budget, Kill-Switch jederzeit.
          </p>
        </section>
      )}

      {/* trace drawer */}
      {selectedAgent && <TraceDrawer agent={selectedAgent} onClose={() => setSelected(null)} />}

      <footer className="mt-12 pb-4 text-center text-xs text-ink-dim">
        Eval ohne UI &amp; ohne Key:{" "}
        <code className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono">npm run eval</code>{" "}
        — beweist Step-Cap, Budget-Invariante, Isolation, Concurrency-Limit, Resume.
      </footer>
    </main>
  );
}

// ---------- components ----------

function Stat({ label, index, children }: { label: string; index: number; children: React.ReactNode }) {
  return (
    <div className="glass enter px-4 py-3" style={{ "--i": index } as React.CSSProperties}>
      <p className="font-display text-[11px] uppercase tracking-wider text-ink-dim">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">{children}</p>
    </div>
  );
}

function AgentCard({
  agent,
  index,
  maxSteps,
  onClick,
}: {
  agent: AgentState;
  index: number;
  maxSteps: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`glass lift enter p-4 text-left ${agent.status === "running" ? "is-running" : ""}`}
      style={{ "--i": index } as React.CSSProperties}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-tight">{agent.itemName}</h3>
        <span className={`${STATUS_CHIP[agent.status]} shrink-0`}>
          {STATUS_LABEL[agent.status]}
          {agent.endReason && agent.endReason !== "finalized" ? ` · ${END_REASON_LABEL[agent.endReason]}` : ""}
        </span>
      </div>
      <p className="mt-2 font-mono text-xs text-ink-dim">
        Steps {agent.steps}/{maxSteps}
        {agent.strikes > 0 && <span className="text-err"> · Strikes {agent.strikes}</span>}
        {" · "}
        {num(agent.usage.inputTokens + agent.usage.outputTokens)} Tok · ${agent.costUsd.toFixed(4)}
      </p>
      {agent.status === "running" && agent.lastAction && (
        <p className="shimmer mt-1.5 truncate font-mono text-xs">{agent.lastAction}</p>
      )}
      {agent.result && <p className="mt-1.5 line-clamp-2 text-xs text-ink-dim">{agent.result}</p>}
      {agent.error && <p className="mt-1.5 line-clamp-2 text-xs text-err">{agent.error}</p>}
    </button>
  );
}

function TraceDrawer({ agent, onClose }: { agent: AgentState; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50">
      {/* backdrop and sheet as SIBLINGS — Safari breaks nested backdrop-filter */}
      <div className="drawer-backdrop absolute inset-0" onClick={onClose} />
      <aside className="glass-sheet drawer-sheet absolute bottom-2 right-2 top-2 w-[min(32rem,calc(100vw-1rem))] overflow-y-auto p-5 sm:bottom-3 sm:right-3 sm:top-3">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">{agent.itemName}</h2>
            <p className="mt-0.5 font-mono text-xs text-ink-dim">
              {STATUS_LABEL[agent.status]}
              {agent.endReason ? ` · ${END_REASON_LABEL[agent.endReason]}` : ""} · {agent.steps} Steps ·{" "}
              {num(agent.usage.inputTokens)} in / {num(agent.usage.outputTokens)} out · $
              {agent.costUsd.toFixed(4)}
            </p>
          </div>
          <button onClick={onClose} aria-label="Schließen" className="btn h-11 w-11 rounded-full p-0 text-ink-dim">
            ✕
          </button>
        </div>

        {agent.result && (
          <p className="mb-4 rounded-2xl border border-ok/20 bg-ok/[0.07] p-3 text-sm">{agent.result}</p>
        )}

        <h3 className="font-display mb-2 text-[11px] uppercase tracking-wider text-ink-dim">
          Agent-Trace ({agent.trace.length} Einträge)
        </h3>
        <ol className="space-y-2">
          {agent.trace.map((t, i) => (
            <li key={i} className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
              <p className="font-mono text-[11px] text-ink-dim">
                {TRACE_ICON[t.kind]} Step {t.step} · {t.kind}
                {t.usage ? ` · ${num(t.usage.inputTokens)} in / ${num(t.usage.outputTokens)} out` : ""}
                {t.retries ? ` · ${t.retries}× Retry` : ""}
              </p>
              <p className="mt-1 break-words text-xs">{t.detail}</p>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
