import { runAgentLoop } from "../agent/agent-loop";
import type { LLMClient } from "../llm/client";
import type { ToolRegistry } from "../tools/registry";
import type { BatchItem, RunConfig, RunState, StopReason } from "../types";
import { TokenBudget } from "./budget";
import type { CheckpointStore } from "./checkpoint";
import type { RunStore } from "./run-store";
import { runPool } from "./scheduler";

/**
 * Ties pool + budget + agent loop together, owns the run lifecycle and the
 * kill switch, emits events, writes checkpoints. Framework-free: the Next.js
 * routes fire-and-forget `done`, the eval simply awaits it.
 */

export interface OrchestratorDeps {
  store: RunStore;
  registry: ToolRegistry;
  llmFactory: (config: RunConfig) => LLMClient;
  checkpoints?: CheckpointStore;
}

interface ActiveRun {
  abort: AbortController;
  stop: (reason: StopReason, hard: boolean) => void;
}

let runSeq = 0;

export class Orchestrator {
  private readonly active = new Map<string, ActiveRun>();

  constructor(private readonly deps: OrchestratorDeps) {}

  hasActiveRun(): boolean {
    return this.active.size > 0;
  }

  /**
   * Creates the run synchronously and starts executing in the background.
   * Callers either await `done` (eval) or fire-and-forget it (API route).
   */
  startRun(config: RunConfig): { runId: string; done: Promise<RunState> } {
    const run = this.buildInitialState(config);
    this.deps.store.create(run);
    return { runId: run.id, done: this.execute(run) };
  }

  /**
   * Resume: completed/failed agents are kept verbatim (not paid twice; a
   * step-capped runaway would just run away again), everything else is reset
   * to pending. The fresh budget starts at the kept agents' spend.
   */
  resumeRun(previous: RunState): { runId: string; done: Promise<RunState> } {
    const run = this.buildInitialState(previous.config);
    run.resumedFrom = previous.id;

    let carriedTokens = 0;
    const pendingItems: BatchItem[] = [];
    for (const item of previous.config.items) {
      const prev = previous.agents[item.id];
      if (prev && (prev.status === "completed" || prev.status === "failed")) {
        run.agents[item.id] = prev;
        carriedTokens += prev.usage.inputTokens + prev.usage.outputTokens;
      } else {
        pendingItems.push(item);
      }
    }

    this.deps.store.create(run);
    return { runId: run.id, done: this.execute(run, pendingItems, carriedTokens) };
  }

  /** manual kill switch: stop scheduling AND abort in-flight LLM calls */
  kill(runId: string): boolean {
    const active = this.active.get(runId);
    if (!active) return false;
    active.stop("kill", true);
    return true;
  }

  private buildInitialState(config: RunConfig): RunState {
    const id = `run_${Date.now().toString(36)}_${++runSeq}`;
    const run: RunState = {
      id,
      status: "running",
      config,
      agents: {},
      budget: { limit: config.globalTokenBudget, used: 0, reserved: 0, peak: 0 },
      costUsd: 0,
      startedAt: Date.now(),
      concurrencyPeak: 0,
    };
    for (const item of config.items) {
      run.agents[item.id] = {
        itemId: item.id,
        itemName: item.name,
        status: "pending",
        steps: 0,
        strikes: 0,
        usage: { inputTokens: 0, outputTokens: 0 },
        costUsd: 0,
        trace: [],
      };
    }
    return run;
  }

  private async execute(run: RunState, itemsOverride?: BatchItem[], initialUsed = 0): Promise<RunState> {
    const { store, registry, llmFactory, checkpoints } = this.deps;
    const items = itemsOverride ?? run.config.items;
    const budget = new TokenBudget(run.config.globalTokenBudget, initialUsed);
    const abort = new AbortController();

    let stopReason: StopReason | undefined;
    const stop = (reason: StopReason, hard: boolean): void => {
      if (stopReason) return;
      stopReason = reason;
      run.stopReason = reason;
      // hard kill aborts in-flight calls; budget exhaustion stops gracefully
      // at step boundaries so already-reserved calls can commit cleanly
      if (hard) abort.abort();
    };
    this.active.set(run.id, { abort, stop });

    const sync = (): void => {
      run.budget = budget.snapshot;
      run.costUsd = Object.values(run.agents).reduce((s, a) => s + a.costUsd, 0);
    };
    const emitRun = (): void => {
      sync();
      store.emit(run.id, { type: "run_update", run });
    };

    try {
      const llm = llmFactory(run.config);
      const pool = await runPool({
        items,
        concurrency: run.config.concurrency,
        shouldStop: () => stopReason !== undefined,
        onActiveChange: (_active, hwm) => {
          run.concurrencyPeak = Math.max(run.concurrencyPeak, hwm);
        },
        worker: async (item) => {
          const agent = await runAgentLoop({
            item,
            config: run.config,
            llm,
            registry,
            globalBudget: budget,
            signal: abort.signal,
            isStopped: () => stopReason !== undefined,
            externalEndReason: () => (stopReason === "budget" ? "global_budget" : "killed"),
            onGlobalBudgetExhausted: () => stop("budget", false),
            onUpdate: (a) => {
              run.agents[a.itemId] = a;
              sync();
              store.emit(run.id, {
                type: "agent_update",
                runId: run.id,
                agent: a,
                budget: run.budget,
                costUsd: run.costUsd,
              });
            },
          });
          // checkpoint once per terminal item — a killed process resumes here
          run.agents[agent.itemId] = agent;
          sync();
          checkpoints?.save(run);
        },
        onWorkerError: (item, err) => {
          // runAgentLoop never throws by contract; this is the last-resort net
          const a = run.agents[item.id];
          a.status = "failed";
          a.endReason = "error";
          a.error = err instanceof Error ? err.message : String(err);
          emitRun();
        },
      });
      run.concurrencyPeak = Math.max(run.concurrencyPeak, pool.highWaterMark);
    } catch (err) {
      // the run itself broke (e.g. LLM client construction, disk error) —
      // `done` must still resolve so fire-and-forget callers stay alive
      stopReason ??= "fatal";
      run.stopReason = stopReason;
      console.error(`run ${run.id} fatal:`, err);
    } finally {
      this.active.delete(run.id);
    }

    // items never claimed because the run stopped early
    for (const a of Object.values(run.agents)) {
      if (a.status === "pending" || a.status === "running") {
        a.status = "aborted";
        a.endReason = stopReason === "budget" ? "global_budget" : "killed";
      }
    }

    run.status = stopReason ? "stopped" : "completed";
    run.endedAt = Date.now();
    emitRun();
    checkpoints?.save(run);
    return run;
  }
}
