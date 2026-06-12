/**
 * Quick manual smoke run: all 15 items through the mock, results as a table.
 * Not the eval (that's run-eval.ts with assertions) — just a dev sanity check.
 *
 *   npm run smoke
 */
import { BATCH_ITEMS } from "../src/items";
import { MockLLMClient } from "../src/llm/mock";
import { CheckpointStore } from "../src/orchestrator/checkpoint";
import { Orchestrator } from "../src/orchestrator/orchestrator";
import { RunStore } from "../src/orchestrator/run-store";
import { ToolRegistry } from "../src/tools/registry";
import { TOOL_DEFINITIONS } from "../src/tools/definitions";
import { DEFAULTS } from "../src/types";

async function main(): Promise<void> {
  const orchestrator = new Orchestrator({
    store: new RunStore(),
    registry: new ToolRegistry(TOOL_DEFINITIONS),
    llmFactory: () => new MockLLMClient({ delayMs: 20 }),
    checkpoints: new CheckpointStore(".runs"),
  });

  const { done } = orchestrator.startRun({
    mode: "mock",
    ...DEFAULTS,
    items: BATCH_ITEMS,
  });

  const run = await done;

  console.log(`\nRun ${run.id} → ${run.status}${run.stopReason ? ` (${run.stopReason})` : ""}`);
  console.log(
    `Concurrency-Peak: ${run.concurrencyPeak}/${run.config.concurrency} · ` +
      `Tokens: ${run.budget.used}/${run.budget.limit} (Peak ${run.budget.peak}) · ` +
      `Kosten: $${run.costUsd.toFixed(4)}\n`,
  );

  for (const item of run.config.items) {
    const a = run.agents[item.id];
    const icon = { completed: "✅", failed: "❌", aborted: "🛑", pending: "⏸", running: "⏳" }[a.status];
    console.log(
      `${icon} ${a.itemName.padEnd(40)} ${a.status}/${a.endReason ?? "-"}`.padEnd(75) +
        ` steps=${a.steps} strikes=${a.strikes} tokens=${a.usage.inputTokens + a.usage.outputTokens}`,
    );
    if (a.result) console.log(`   ↳ ${a.result.slice(0, 110)}`);
    if (a.error) console.log(`   ↳ ${a.error}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
