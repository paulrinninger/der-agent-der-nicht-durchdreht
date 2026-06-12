"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BATCH_ITEMS } from "@/src/items";
import type { RunEvent, RunMode, RunState } from "@/src/types";
import { AgentRoster } from "./components/AgentRoster";
import { BudgetCore } from "./components/BudgetCore";
import { ControlsBar } from "./components/ControlsBar";
import { FinaleBand } from "./components/FinaleBand";
import { useBurnSeries, useSlotAssignments, useTicker } from "./components/hooks";
import { ItemEditor, type EditorItem } from "./components/ItemEditor";
import { MissionHeader } from "./components/MissionHeader";
import { CHAOS_ITEMS, type PresetDef } from "./components/presets";
import { RunTimeline } from "./components/RunTimeline";
import { SchedulerDeck } from "./components/SchedulerDeck";
import { Ticker } from "./components/Ticker";
import { TraceDrawer } from "./components/TraceDrawer";
import { makePreviewRun } from "./components/tour/preview";
import { Tour } from "./components/tour/Tour";

const ITEMS_LS_KEY = "agency.items.v1";
const DEFAULT_EDITOR_ITEMS: EditorItem[] = BATCH_ITEMS.map((i) => ({
  name: i.name,
  pitch: i.pitch,
  chaos: false,
}));

function readStoredItems(): EditorItem[] | null {
  try {
    const raw = localStorage.getItem(ITEMS_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: number; items?: unknown };
    if (parsed.v !== 1 || !Array.isArray(parsed.items)) return null;
    const items = parsed.items
      .map((i) => ({
        name: String((i as EditorItem).name ?? "").slice(0, 60),
        pitch: String((i as EditorItem).pitch ?? "").slice(0, 200),
        chaos: Boolean((i as EditorItem).chaos),
      }))
      .filter((i) => i.name || i.pitch);
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

export default function MissionControl() {
  const [run, setRun] = useState<RunState | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [mode, setMode] = useState<RunMode>("mock");
  const [concurrency, setConcurrency] = useState(3);
  const [budget, setBudget] = useState(200_000);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [customItems, setCustomItems] = useState<EditorItem[] | null>(null);
  const [preset, setPreset] = useState<PresetDef["key"] | null>("kontrolliert");

  // hydrate custom items after mount (SSR-safe), persist on change
  useEffect(() => {
    setCustomItems(readStoredItems());
  }, []);
  const changeItems = useCallback((items: EditorItem[] | null) => {
    setCustomItems(items);
    setPreset(null);
    try {
      if (items) localStorage.setItem(ITEMS_LS_KEY, JSON.stringify({ v: 1, items }));
      else localStorage.removeItem(ITEMS_LS_KEY);
    } catch {
      /* quota/private mode: session-only */
    }
  }, []);

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

  // tour-controlled start: always mock/standard/default items (a tour never
  // starts a paid run), and the controls UI is synced to what actually launches
  const startTourRun = useCallback(() => {
    setMode("mock");
    setConcurrency(3);
    setBudget(200_000);
    void post("/api/runs", { mode: "mock", concurrency: 3, globalTokenBudget: 200_000 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPreset = (p: PresetDef): void => {
    setPreset(p.key);
    setBudget(p.budget);
    setConcurrency(p.concurrency);
  };

  const startRun = (): void => {
    const startItems =
      preset === "chaos"
        ? CHAOS_ITEMS.map(({ name, pitch, scenario }) => ({ name, pitch, scenario }))
        : customItems
            ?.filter((i) => i.name.trim() && i.pitch.trim())
            .map((i) => ({
              name: i.name,
              pitch: i.pitch,
              ...(i.chaos ? { scenario: "runaway" as const } : {}),
            }));
    void post("/api/runs", {
      mode,
      concurrency,
      globalTokenBudget: budget,
      ...(startItems && startItems.length > 0 ? { items: startItems } : {}),
    });
  };

  // render-only preview while the tour is open on an empty dashboard — gives
  // the spotlight real targets (empty bays, full queue, 0% gauge). All logic
  // (isRunning, FinaleBand, tour predicates) stays on the REAL run.
  const preview = useMemo(
    () => (tourOpen && !run ? makePreviewRun(concurrency, budget) : null),
    [tourOpen, run, concurrency, budget],
  );
  const view = run ?? preview;

  const slots = useSlotAssignments(view);
  const ticker = useTicker(view);
  const burn = useBurnSeries(view);

  const agents = view ? view.config.items.map((i) => view.agents[i.id]).filter(Boolean) : [];
  const isRunning = run?.status === "running";
  const isTerminal = run !== null && run.status !== "running";
  const canResume = run !== null && run.status === "stopped";
  const selectedAgent = selected && run ? run.agents[selected] : null;

  return (
    <main className="mx-auto max-w-[78rem] px-4 py-8 sm:px-6 sm:py-10">
      <MissionHeader run={run} onTour={() => setTourOpen(true)} />

      <ControlsBar
        mode={mode}
        onMode={setMode}
        concurrency={concurrency}
        onConcurrency={(n) => {
          setConcurrency(n);
          setPreset(null);
        }}
        budget={budget}
        onBudget={(n) => {
          setBudget(n);
          setPreset(null);
        }}
        preset={preset}
        onPreset={applyPreset}
        itemCount={preset === "chaos" ? CHAOS_ITEMS.length : (customItems ?? DEFAULT_EDITOR_ITEMS).length}
        onOpenItems={() => setEditorOpen(true)}
        hasApiKey={hasApiKey}
        isRunning={isRunning}
        canResume={canResume}
        busy={busy}
        onStart={startRun}
        onResume={() => run && post(`/api/runs/${run.id}/resume`)}
        onKill={() => run && post(`/api/runs/${run.id}/kill`)}
      />

      {error && <p className="alert-err mb-4 px-4 py-3 text-sm">{error}</p>}

      {view ? (
        <>
          <div className="mb-4 grid gap-4 lg:grid-cols-12">
            <div className="enter lg:col-span-8" style={{ "--i": 2 } as React.CSSProperties}>
              <SchedulerDeck run={view} slots={slots} />
            </div>
            <div className="enter lg:col-span-4" style={{ "--i": 3 } as React.CSSProperties}>
              <BudgetCore
                budget={view.budget}
                costUsd={view.costUsd}
                series={burn}
                mode={view.config.mode}
                live={isRunning}
              />
            </div>
          </div>

          {run && run.id !== "tour-preview" && <RunTimeline run={run} live={isRunning} />}

          {isTerminal && run && <FinaleBand run={run} />}

          <div className="grid items-start gap-4 lg:grid-cols-12">
            <div
              className="enter lg:sticky lg:top-4 lg:col-span-4"
              style={{ "--i": 4 } as React.CSSProperties}
            >
              <Ticker entries={ticker} startedAt={view.startedAt} live={isRunning} />
            </div>
            <div className="lg:col-span-8">
              <AgentRoster
                agents={agents}
                maxSteps={view.config.maxStepsPerAgent}
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

      <ItemEditor
        open={editorOpen}
        items={customItems}
        defaults={DEFAULT_EDITOR_ITEMS}
        mode={mode}
        chaosPresetActive={preset === "chaos"}
        onChange={changeItems}
        onClose={() => setEditorOpen(false)}
      />

      <Tour
        open={tourOpen}
        onOpenChange={setTourOpen}
        run={run}
        busy={busy}
        onStartMock={startTourRun}
      />

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
