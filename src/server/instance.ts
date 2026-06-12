import { tmpdir } from "node:os";
import { join } from "node:path";
import { AnthropicLLMClient } from "../llm/anthropic";
import { MockLLMClient } from "../llm/mock";
import { CheckpointStore } from "../orchestrator/checkpoint";
import { Orchestrator } from "../orchestrator/orchestrator";
import { RunStore } from "../orchestrator/run-store";
import { TOOL_DEFINITIONS } from "../tools/definitions";
import { ToolRegistry } from "../tools/registry";

/**
 * Process-wide singletons for the Next.js layer. In `next dev`, HMR
 * re-evaluates modules — a plain module-level instance would silently reset
 * mid-run, so everything hangs off globalThis (same pattern Prisma uses).
 */

export interface ServerInstance {
  store: RunStore;
  orchestrator: Orchestrator;
  checkpoints: CheckpointStore;
}

/** `.runs` im Projekt; auf read-only Dateisystemen (Vercel) tmp-Fallback —
 *  Resume gilt dort nur für die Lebensdauer der warmen Instanz. */
function makeCheckpoints(): CheckpointStore {
  try {
    return new CheckpointStore(".runs");
  } catch {
    return new CheckpointStore(join(tmpdir(), "agency-runs"));
  }
}

function build(): ServerInstance {
  const store = new RunStore();
  const checkpoints = makeCheckpoints();
  const orchestrator = new Orchestrator({
    store,
    checkpoints,
    registry: new ToolRegistry(TOOL_DEFINITIONS),
    llmFactory: (config) =>
      config.mode === "anthropic" ? new AnthropicLLMClient() : new MockLLMClient(),
  });
  return { store, orchestrator, checkpoints };
}

const g = globalThis as unknown as { __agentServer?: ServerInstance };
export const server: ServerInstance = (g.__agentServer ??= build());

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
