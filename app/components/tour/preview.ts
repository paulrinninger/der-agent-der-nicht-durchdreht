import { BATCH_ITEMS } from "@/src/items";
import { DEFAULTS, ZERO_USAGE, type RunState } from "@/src/types";

/**
 * Render-only idle RunState: gives the tour real spotlight targets (empty
 * bays, full queue, 0% gauge, the toaster card) on a fresh visit where no
 * run exists yet. Never used for logic — page.tsx keeps isRunning/isTerminal/
 * FinaleBand on the REAL run. The id differs from any real run id, so the
 * derivation hooks (keyed on run.id) reset cleanly when a real run attaches.
 */
export function makePreviewRun(concurrency: number, budget: number): RunState {
  return {
    id: "tour-preview",
    status: "running",
    config: {
      mode: "mock",
      concurrency,
      globalTokenBudget: budget,
      items: BATCH_ITEMS,
      maxStepsPerAgent: DEFAULTS.maxStepsPerAgent,
      maxTokensPerAgent: DEFAULTS.maxTokensPerAgent,
      maxStrikes: DEFAULTS.maxStrikes,
      maxTokensPerCall: DEFAULTS.maxTokensPerCall,
    },
    agents: Object.fromEntries(
      BATCH_ITEMS.map((i) => [
        i.id,
        {
          itemId: i.id,
          itemName: i.name,
          status: "pending" as const,
          steps: 0,
          strikes: 0,
          usage: { ...ZERO_USAGE },
          costUsd: 0,
          trace: [],
        },
      ]),
    ),
    budget: { limit: budget, used: 0, reserved: 0, peak: 0 },
    costUsd: 0,
    startedAt: Date.now(),
    concurrencyPeak: 0,
  };
}
