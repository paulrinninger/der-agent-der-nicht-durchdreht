import type { AgentState } from "@/src/types";

/**
 * Pure client-side derivations from existing run state — the core stays
 * untouched, everything here reads what the orchestrator already emits.
 */

export const PIPELINE = ["research", "draft", "critique", "finalize"] as const;
export type Stage = (typeof PIPELINE)[number];

/** which tools executed successfully — trace detail is `name({...}) → …` */
export function pipelineStages(agent: AgentState): Record<Stage, boolean> {
  const done: Record<Stage, boolean> = {
    research: false,
    draft: false,
    critique: false,
    finalize: false,
  };
  for (const t of agent.trace) {
    if (t.kind !== "tool_executed") continue;
    for (const s of PIPELINE) if (t.detail.startsWith(s + "(")) done[s] = true;
  }
  return done;
}

export type Verdict = "invest" | "pass" | null;

/** finalize output is `💸 INVEST — …` or `🙅 PASS — …` */
export function parseVerdict(result?: string): Verdict {
  if (!result) return null;
  if (result.startsWith("\u{1F4B8}")) return "invest";
  if (result.startsWith("\u{1F645}")) return "pass";
  return null;
}

/** telemetry timestamp relative to run start: `t+04,2s` */
export function formatT(ts: number, startedAt: number): string {
  const s = Math.max(0, (ts - startedAt) / 1000);
  return `t+${s.toFixed(1).replace(".", ",").padStart(4, "0")}s`;
}

export function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
}
