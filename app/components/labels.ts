import type { AgentState, EndReason, TraceKind } from "@/src/types";

/**
 * Status- und Trace-Beschriftung nach dem Design-Mockup: Pill-Klassen
 * (queued/running/done/stopped/killed) + Title-Case-Labels.
 */

export type PillClass = "queued" | "running" | "done" | "stopped" | "killed";

/** maps our status (+ endReason) onto the design's five pill states */
export function pillFor(agent: AgentState): { cls: PillClass; label: string } {
  switch (agent.status) {
    case "pending":
      return { cls: "queued", label: "Wartet" };
    case "running":
      return { cls: "running", label: "Läuft" };
    case "completed":
      return { cls: "done", label: "Fertig" };
    case "failed":
      switch (agent.endReason) {
        case "step_cap":
          return { cls: "stopped", label: "Step-Cap" };
        case "token_cap":
          return { cls: "stopped", label: "Token-Cap" };
        case "strikes":
          return { cls: "stopped", label: "3 Strikes" };
        case "no_finalize":
          return { cls: "stopped", label: "Kein Urteil" };
        default:
          return { cls: "stopped", label: "Fehler" };
      }
    case "aborted":
      return agent.endReason === "global_budget"
        ? { cls: "killed", label: "Budget" }
        : { cls: "killed", label: "Kill-Switch" };
  }
}

export const END_REASON_LABEL: Record<EndReason, string> = {
  finalized: "Urteil abgegeben",
  step_cap: "Step-Cap erreicht",
  token_cap: "Token-Cap erreicht",
  strikes: "3 Strikes — ungültige Tool-Calls",
  no_finalize: "Kein Urteil abgegeben",
  error: "LLM-Fehler",
  killed: "Kill-Switch",
  global_budget: "Globales Budget erschöpft",
};

/** trace kind -> design trace-line class */
export const TRACE_CLS: Record<TraceKind, string> = {
  llm_call: "tr-call",
  tool_executed: "tr-ok",
  tool_rejected: "tr-reject",
  tool_error: "tr-fail",
  reminder: "tr-info",
  terminal: "tr-done",
};

export const num = (n: number): string => n.toLocaleString("de-DE");

/** tool calls = executed + rejected + errored entries in the trace */
export function callCount(agent: AgentState): number {
  return agent.trace.filter(
    (t) => t.kind === "tool_executed" || t.kind === "tool_rejected" || t.kind === "tool_error",
  ).length;
}
