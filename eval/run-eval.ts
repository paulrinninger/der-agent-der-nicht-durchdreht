/**
 * Eval-/Test-Modus: beweist die vier Pflicht-Kriterien deterministisch,
 * ohne API-Key, ohne Next.js-Server. Exit 0 = alles grün, Exit 1 = Bruch.
 *
 *   npm run eval
 *
 * Geprüft wird:
 *   1. Concurrency-Limit hält exakt (High-Water-Mark === Limit, auch bei 50 Items)
 *   2. Step-Cap stoppt einen Runaway-Agenten — Geschwister laufen ungestört
 *   3. Erfundenes Tool -> error-tool_result -> Agent korrigiert sich (1 Strike)
 *   4. Kaputte Args (falsche Keys, String, null) -> 3 Strikes -> failed
 *   5. end_turn ohne finalize -> 1 Erinnerung -> failed/no_finalize
 *   6. Crashender LLM-Call -> failed/error, alle Geschwister completed (Isolation)
 *   7. Globales Budget: Kill-Switch greift im Flug, peak(used+reserved) <= limit
 *   8. Flaky Tool wird per Retry/Backoff gerettet
 *   9. Resume: fertige Agenten werden nicht doppelt bezahlt
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockLLMClient, type MockOptions } from "../src/llm/mock";
import { CheckpointStore } from "../src/orchestrator/checkpoint";
import { Orchestrator } from "../src/orchestrator/orchestrator";
import { RunStore } from "../src/orchestrator/run-store";
import { TOOL_DEFINITIONS } from "../src/tools/definitions";
import { ToolRegistry } from "../src/tools/registry";
import { DEFAULTS, totalTokens, type BatchItem, type MockScenario, type RunConfig, type RunState } from "../src/types";

// ---------- mini test harness ----------

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}
const checks: Check[] = [];

function check(name: string, ok: boolean, detail = ""): void {
  checks.push({ name, ok, detail });
}

function item(id: string, scenario: MockScenario): BatchItem {
  return { id, name: `Testcase ${id}`, pitch: `Szenario ${scenario}`, scenario };
}

function config(items: BatchItem[], overrides: Partial<RunConfig> = {}): RunConfig {
  return { mode: "mock", ...DEFAULTS, ...overrides, items };
}

function setup(mock: MockOptions = {}, checkpoints?: CheckpointStore) {
  const store = new RunStore();
  const orchestrator = new Orchestrator({
    store,
    registry: new ToolRegistry(TOOL_DEFINITIONS),
    llmFactory: () => new MockLLMClient({ delayMs: 5, ...mock }),
    checkpoints,
  });
  return { store, orchestrator };
}

const byStatus = (run: RunState, status: string) =>
  Object.values(run.agents).filter((a) => a.status === status);

// ---------- the eval ----------

async function main(): Promise<void> {
  // 1) concurrency: 50 items, limit 3 — never more, pool refills to exactly 3
  {
    const { orchestrator } = setup();
    const items = Array.from({ length: 50 }, (_, i) => item(`c${i}`, "happy"));
    const run = await orchestrator.startRun(config(items, { concurrency: 3, globalTokenBudget: 1_000_000 })).done;
    check(
      "Concurrency-Limit hält (HWM === 3 bei 50 Items)",
      run.concurrencyPeak === 3 && run.status === "completed",
      `peak=${run.concurrencyPeak}, status=${run.status}`,
    );
    check(
      "Alle 50 Items abgeschlossen (Architektur skaliert über 15 hinaus)",
      byStatus(run, "completed").length === 50,
      `completed=${byStatus(run, "completed").length}/50`,
    );
  }

  // 2) runaway + isolation: the step cap kills it, siblings finish
  {
    const { orchestrator } = setup();
    const run = await orchestrator.startRun(
      config([item("r1", "runaway"), item("h1", "happy"), item("h2", "happy")], { maxStepsPerAgent: 6 }),
    ).done;
    const runaway = run.agents["r1"];
    check(
      "Step-Cap stoppt Runaway (failed/step_cap bei exakt maxSteps)",
      runaway.status === "failed" && runaway.endReason === "step_cap" && runaway.steps === 6,
      `status=${runaway.status}/${runaway.endReason}, steps=${runaway.steps}`,
    );
    check(
      "Runaway reißt Geschwister nicht mit",
      byStatus(run, "completed").length === 2 && run.status === "completed",
      `completed=${byStatus(run, "completed").length}/2`,
    );
  }

  // 3) invented tool: error result goes back, model recovers — 1 strike, completed
  {
    const { orchestrator } = setup();
    const run = await orchestrator.startRun(config([item("u1", "invented-tool")])).done;
    const a = run.agents["u1"];
    check(
      "Erfundenes Tool: abgelehnt, Agent korrigiert sich selbst",
      a.status === "completed" && a.strikes === 1 && a.trace.some((t) => t.kind === "tool_rejected"),
      `status=${a.status}, strikes=${a.strikes}`,
    );
  }

  // 4) broken args (wrong keys / raw string / null): three strikes -> failed
  {
    const { orchestrator } = setup();
    const run = await orchestrator.startRun(config([item("b1", "broken-args")])).done;
    const a = run.agents["b1"];
    check(
      "Kaputte Args crashen nichts: 3 Strikes -> failed/strikes",
      a.status === "failed" && a.endReason === "strikes" && a.strikes === 3,
      `status=${a.status}/${a.endReason}, strikes=${a.strikes}`,
    );
  }

  // 5) end_turn without finalize: one reminder, then failed/no_finalize
  {
    const { orchestrator } = setup();
    const run = await orchestrator.startRun(config([item("n1", "no-finalize")])).done;
    const a = run.agents["n1"];
    check(
      "Kein finalize: 1 Erinnerung, dann failed/no_finalize",
      a.status === "failed" && a.endReason === "no_finalize" && a.trace.some((t) => t.kind === "reminder"),
      `status=${a.status}/${a.endReason}`,
    );
  }

  // 6) crashing LLM call: agent failed/error, ALL siblings completed
  {
    const { orchestrator } = setup();
    const items = [item("x1", "crasher"), ...Array.from({ length: 4 }, (_, i) => item(`h${i}`, "happy"))];
    const run = await orchestrator.startRun(config(items)).done;
    const crasher = run.agents["x1"];
    check(
      "LLM-Crash isoliert: failed/error, Batch läuft weiter",
      crasher.status === "failed" &&
        crasher.endReason === "error" &&
        byStatus(run, "completed").length === 4 &&
        run.status === "completed",
      `crasher=${crasher.status}/${crasher.endReason}, completed=${byStatus(run, "completed").length}/4`,
    );
  }

  // 7a) global budget, sequential (deterministic): stops cleanly mid-run
  {
    const { orchestrator } = setup({ usagePerCall: { inputTokens: 200, outputTokens: 100 } });
    const items = Array.from({ length: 10 }, (_, i) => item(`g${i}`, "happy"));
    const run = await orchestrator.startRun(config(items, { concurrency: 1, globalTokenBudget: 5_000 })).done;
    check(
      "Budget-Kill-Switch (seriell): Run stoppt mit stopReason=budget",
      run.status === "stopped" && run.stopReason === "budget",
      `status=${run.status}/${run.stopReason}`,
    );
    check(
      "Budget im Flug eingehalten: peak(used+reserved) <= limit",
      run.budget.peak <= run.budget.limit && run.budget.used <= run.budget.limit,
      `peak=${run.budget.peak}, used=${run.budget.used}, limit=${run.budget.limit}`,
    );
    check(
      "Teilergebnis statt Totalverlust: >=1 completed UND >=1 aborted/global_budget",
      byStatus(run, "completed").length >= 1 &&
        byStatus(run, "aborted").some((a) => a.endReason === "global_budget"),
      `completed=${byStatus(run, "completed").length}, aborted=${byStatus(run, "aborted").length}`,
    );
  }

  // 7b) global budget under real concurrency: reservation closes the race
  {
    const { orchestrator } = setup({ usagePerCall: { inputTokens: 200, outputTokens: 100 } });
    const items = Array.from({ length: 12 }, (_, i) => item(`p${i}`, "happy"));
    const run = await orchestrator.startRun(config(items, { concurrency: 4, globalTokenBudget: 8_000 })).done;
    check(
      "Budget unter Concurrency: kein Overshoot trotz 4 paralleler Agenten",
      run.stopReason === "budget" && run.budget.peak <= run.budget.limit && run.budget.used <= run.budget.limit,
      `peak=${run.budget.peak}, used=${run.budget.used}, limit=${run.budget.limit}`,
    );
  }

  // 8) flaky tool: transient failure rescued by retry/backoff
  {
    const { orchestrator } = setup();
    const run = await orchestrator.startRun(config([item("f1", "flaky-tool")])).done;
    const a = run.agents["f1"];
    const retried = a.trace.find((t) => t.kind === "tool_executed" && (t.retries ?? 0) > 0);
    check(
      "Flaky Tool: Retry mit Backoff rettet den Call (ohne den Batch zu blockieren)",
      a.status === "completed" && retried !== undefined,
      `status=${a.status}, retries=${retried?.retries ?? 0}`,
    );
  }

  // 9) resume: kill mid-run, resume from checkpoint, completed agents not paid twice
  {
    const checkpoints = new CheckpointStore(mkdtempSync(join(tmpdir(), "agent-eval-")));
    const { store, orchestrator } = setup({ delayMs: 10 }, checkpoints);
    const items = Array.from({ length: 6 }, (_, i) => item(`s${i}`, "happy"));
    const { runId, done } = orchestrator.startRun(config(items, { concurrency: 1 }));

    // kill as soon as the first agent completes
    const unsub = store.subscribe(runId, (e) => {
      if (e.type === "agent_update" && e.agent.status === "completed") {
        orchestrator.kill(runId);
        unsub();
      }
    });
    const stopped = await done;
    const completedBefore = byStatus(stopped, "completed");
    check(
      "Kill-Switch: Run manuell gestoppt, Rest aborted/killed",
      stopped.status === "stopped" &&
        stopped.stopReason === "kill" &&
        completedBefore.length === 1 &&
        byStatus(stopped, "aborted").every((a) => a.endReason === "killed"),
      `status=${stopped.status}/${stopped.stopReason}, completed=${completedBefore.length}`,
    );

    const fromDisk = checkpoints.load(stopped.id);
    const resumed = await orchestrator.resumeRun(fromDisk!).done;
    const kept = resumed.agents[completedBefore[0].itemId];
    const sumTokens = Object.values(resumed.agents).reduce((s, a) => s + totalTokens(a.usage), 0);
    check(
      "Resume: alle Items fertig, fertiger Agent unangetastet übernommen",
      resumed.status === "completed" &&
        byStatus(resumed, "completed").length === 6 &&
        kept.steps === completedBefore[0].steps &&
        totalTokens(kept.usage) === totalTokens(completedBefore[0].usage),
      `completed=${byStatus(resumed, "completed").length}/6`,
    );
    check(
      "Resume: Budget zählt Übernommenes genau einmal (used === Summe aller Agent-Usage)",
      resumed.budget.used === sumTokens,
      `used=${resumed.budget.used}, sum=${sumTokens}`,
    );
  }

  // ---------- report ----------

  const failed = checks.filter((c) => !c.ok);
  const w = Math.max(...checks.map((c) => c.name.length));
  console.log("\n── Eval: der Agent, der nicht durchdreht ──────────────────────\n");
  for (const c of checks) {
    console.log(` ${c.ok ? "✅ PASS" : "❌ FAIL"}  ${c.name.padEnd(w)}  ${c.detail}`);
  }
  console.log(`\n ${checks.length - failed.length}/${checks.length} Checks grün\n`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Eval-Harness selbst hat geworfen:", err);
  process.exit(1);
});
