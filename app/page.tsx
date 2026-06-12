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
  pending: "bg-panel-2 text-ink-dim border-line",
  running: "bg-accent/10 text-accent border-accent/40",
  completed: "bg-ok/10 text-ok border-ok/40",
  failed: "bg-err/10 text-err border-err/40",
  aborted: "bg-warn/10 text-warn border-warn/40",
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
    <main className="mx-auto max-w-6xl px-6 py-10">
      {/* header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          der agent, der nicht durchdreht<span className="text-accent">.</span>
        </h1>
        <p className="mt-1 text-sm text-ink-dim">
          15 Quatsch-Startups · je ein Agent mit Tools · Concurrency-Limit, Tool-Call-Validierung,
          Step-/Budget-Caps, globaler Kill-Switch
        </p>
      </header>

      {/* controls */}
      <section className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-line bg-panel p-4">
        <div>
          <label className="mb-1 block text-xs text-ink-dim">Modus</label>
          <div className="flex overflow-hidden rounded-lg border border-line">
            <button
              onClick={() => setMode("mock")}
              disabled={isRunning}
              className={`px-3 py-1.5 text-sm ${mode === "mock" ? "bg-accent/15 text-accent" : "bg-panel-2 text-ink-dim"}`}
            >
              Mock ($0)
            </button>
            <button
              onClick={() => setMode("anthropic")}
              disabled={isRunning || !hasApiKey}
              title={hasApiKey ? "claude-haiku-4-5" : "Kein ANTHROPIC_API_KEY in .env — Mock-Modus verfügbar"}
              className={`px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${
                mode === "anthropic" ? "bg-accent/15 text-accent" : "bg-panel-2 text-ink-dim"
              }`}
            >
              Claude Haiku
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-dim">Parallel (max)</label>
          <select
            value={concurrency}
            disabled={isRunning}
            onChange={(e) => setConcurrency(Number(e.target.value))}
            className="rounded-lg border border-line bg-panel-2 px-3 py-1.5 text-sm"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-dim">Token-Budget (global)</label>
          <input
            type="number"
            value={budget}
            disabled={isRunning}
            min={1_000}
            step={1_000}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="w-32 rounded-lg border border-line bg-panel-2 px-3 py-1.5 font-mono text-sm"
          />
        </div>
        <div className="ml-auto flex gap-2">
          {canResume && (
            <button
              onClick={() => post(`/api/runs/${run.id}/resume`)}
              disabled={busy}
              className="rounded-lg border border-warn/50 bg-warn/10 px-4 py-1.5 text-sm font-medium text-warn hover:bg-warn/20"
            >
              ↻ Fortsetzen
            </button>
          )}
          {isRunning ? (
            <button
              onClick={() => post(`/api/runs/${run.id}/kill`)}
              disabled={busy}
              className="rounded-lg border border-err/50 bg-err/10 px-5 py-1.5 text-sm font-semibold text-err hover:bg-err/25"
            >
              ■ Kill-Switch
            </button>
          ) : (
            <button
              onClick={() => post("/api/runs", { mode, concurrency, globalTokenBudget: budget })}
              disabled={busy}
              className="rounded-lg border border-ok/50 bg-ok/10 px-5 py-1.5 text-sm font-semibold text-ok hover:bg-ok/25"
            >
              ▶ Batch starten
            </button>
          )}
        </div>
      </section>

      {error && (
        <p className="mb-4 rounded-lg border border-err/40 bg-err/10 px-4 py-2 text-sm text-err">{error}</p>
      )}

      {run ? (
        <>
          {/* stats */}
          <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Status">
              <span className={isRunning ? "text-accent" : run.status === "completed" ? "text-ok" : "text-warn"}>
                {run.status === "running" ? "AKTIV" : run.status === "completed" ? "FERTIG" : "GESTOPPT"}
                {run.stopReason ? ` (${run.stopReason === "budget" ? "Budget" : run.stopReason === "kill" ? "Kill" : "Fatal"})` : ""}
              </span>
            </Stat>
            <Stat label={`Aktiv / Limit ${run.config.concurrency}`}>
              {count("running")}
              <span className="text-ink-dim"> · Peak {run.concurrencyPeak}</span>
            </Stat>
            <Stat label="Fertig">
              <span className="text-ok">{count("completed")}</span>
              <span className="text-ink-dim"> / {agents.length}</span>
            </Stat>
            <Stat label="Fehler / Gestoppt">
              <span className="text-err">{count("failed")}</span>
              <span className="text-ink-dim"> / </span>
              <span className="text-warn">{count("aborted")}</span>
            </Stat>
            <Stat label="Tokens">
              {num(run.budget.used)}
              <span className="text-ink-dim"> / {num(run.budget.limit)}</span>
            </Stat>
            <Stat label={`Kosten (${run.config.mode === "mock" ? "simuliert" : "Haiku"})`}>
              ${run.costUsd.toFixed(4)}
            </Stat>
          </section>

          {/* budget bar */}
          <section className="mb-6">
            <div className="h-2.5 overflow-hidden rounded-full border border-line bg-panel">
              <div className="flex h-full">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${Math.min(100, (run.budget.used / run.budget.limit) * 100)}%` }}
                />
                <div
                  className="h-full bg-accent/30 transition-all duration-300"
                  style={{ width: `${Math.min(100, (run.budget.reserved / run.budget.limit) * 100)}%` }}
                  title="reserviert für laufende Calls"
                />
              </div>
            </div>
            <p className="mt-1 font-mono text-xs text-ink-dim">
              verbraucht {num(run.budget.used)} · reserviert {num(run.budget.reserved)} · Peak{" "}
              {num(run.budget.peak)} / {num(run.budget.limit)}
            </p>
          </section>

          {/* agent cards */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((a) => (
              <AgentCard key={a.itemId} agent={a} maxSteps={run.config.maxStepsPerAgent} onClick={() => setSelected(a.itemId)} />
            ))}
          </section>
        </>
      ) : (
        <section className="rounded-xl border border-dashed border-line bg-panel p-12 text-center text-ink-dim">
          <p className="text-lg">Noch kein Lauf.</p>
          <p className="mt-1 text-sm">
            „Batch starten“ schickt 15 Quatsch-Startups durch je einen Agenten — max.{" "}
            {concurrency} parallel, hartes Budget, Kill-Switch jederzeit.
          </p>
        </section>
      )}

      {/* trace drawer */}
      {selectedAgent && (
        <TraceDrawer agent={selectedAgent} onClose={() => setSelected(null)} />
      )}

      <footer className="mt-10 text-xs text-ink-dim">
        Eval ohne UI &amp; ohne Key: <code className="font-mono">npm run eval</code> — beweist Step-Cap,
        Budget-Invariante, Isolation, Concurrency-Limit, Resume.
      </footer>
    </main>
  );
}

// ---------- components ----------

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-ink-dim">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-semibold">{children}</p>
    </div>
  );
}

function AgentCard({ agent, maxSteps, onClick }: { agent: AgentState; maxSteps: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-line bg-panel p-4 text-left transition-colors hover:border-accent/50"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-tight">{agent.itemName}</h3>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${STATUS_CHIP[agent.status]}`}>
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
        <p className="mt-1 truncate font-mono text-xs text-accent">{agent.lastAction}</p>
      )}
      {agent.result && <p className="mt-1 line-clamp-2 text-xs text-ink-dim">{agent.result}</p>}
      {agent.error && <p className="mt-1 line-clamp-2 text-xs text-err">{agent.error}</p>}
    </button>
  );
}

function TraceDrawer({ agent, onClose }: { agent: AgentState; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <aside
        className="h-full w-full max-w-lg overflow-y-auto border-l border-line bg-panel p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{agent.itemName}</h2>
            <p className="font-mono text-xs text-ink-dim">
              {STATUS_LABEL[agent.status]}
              {agent.endReason ? ` · ${END_REASON_LABEL[agent.endReason]}` : ""} · {agent.steps} Steps ·{" "}
              {num(agent.usage.inputTokens)} in / {num(agent.usage.outputTokens)} out · $
              {agent.costUsd.toFixed(4)}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-line px-2.5 py-1 text-sm text-ink-dim hover:text-ink">
            ✕
          </button>
        </div>

        {agent.result && (
          <p className="mb-4 rounded-lg border border-ok/30 bg-ok/5 p-3 text-sm">{agent.result}</p>
        )}

        <h3 className="mb-2 text-[11px] uppercase tracking-wider text-ink-dim">
          Agent-Trace ({agent.trace.length} Einträge)
        </h3>
        <ol className="space-y-2">
          {agent.trace.map((t, i) => (
            <li key={i} className="rounded-lg border border-line bg-panel-2 p-2.5">
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
