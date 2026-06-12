import type { EndReason, ItemStatus, TraceKind } from "@/src/types";

export const STATUS_LABEL: Record<ItemStatus, string> = {
  pending: "wartet",
  running: "läuft",
  completed: "fertig",
  failed: "Fehler",
  aborted: "gestoppt",
};

export const STATUS_CHIP: Record<ItemStatus, string> = {
  pending: "chip chip-pending",
  running: "chip chip-running",
  completed: "chip chip-completed",
  failed: "chip chip-failed",
  aborted: "chip chip-aborted",
};

export const END_REASON_LABEL: Record<EndReason, string> = {
  finalized: "finalize",
  step_cap: "Step-Cap",
  token_cap: "Token-Cap",
  strikes: "3 Strikes",
  no_finalize: "kein finalize",
  error: "LLM-Fehler",
  killed: "Kill-Switch",
  global_budget: "Budget",
};

/** mono telemetry glyphs — deliberately no emoji */
export const KIND_GLYPH: Record<TraceKind, string> = {
  llm_call: "◇",
  tool_executed: "▸",
  tool_rejected: "✕",
  tool_error: "!",
  reminder: "↻",
  terminal: "■",
};

export const num = (n: number): string => n.toLocaleString("de-DE");
