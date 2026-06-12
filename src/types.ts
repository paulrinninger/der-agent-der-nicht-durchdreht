/**
 * Shared domain types. Kept dependency-free so the core (`src/`) can be
 * imported both from Next.js route handlers and directly from `eval/` via tsx.
 */

// ---------- usage & cost ----------

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export const ZERO_USAGE: Usage = { inputTokens: 0, outputTokens: 0 };

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
  };
}

export function totalTokens(u: Usage): number {
  return u.inputTokens + u.outputTokens;
}

// ---------- items ----------

/**
 * Scenario keys steer the deterministic mock LLM (and one flaky tool).
 * The real Anthropic client ignores them entirely.
 */
export type MockScenario =
  | "happy"
  | "runaway" // never calls finalize -> must die at the step cap
  | "invented-tool" // proposes a non-existent tool once, then recovers
  | "broken-args" // sends schema-violating args three times -> strikes out
  | "crasher" // the LLM call itself throws -> failed/error, siblings unaffected
  | "no-finalize" // ends turn without finalize twice -> failed/no_finalize
  | "flaky-tool"; // research tool fails transiently -> retry/backoff saves it

export interface BatchItem {
  id: string;
  name: string;
  pitch: string;
  scenario: MockScenario;
}

// ---------- agent state machine ----------

export type ItemStatus = "pending" | "running" | "completed" | "failed" | "aborted";

/**
 * Two terminal families:
 *  - `failed`  = the agent's own fault (stays failed on resume — a runaway
 *                would just run away again and burn budget for a known outcome)
 *  - `aborted` = external cause (kill switch / global budget) — reset on resume
 */
export type EndReason =
  | "finalized"
  | "step_cap"
  | "token_cap"
  | "strikes"
  | "no_finalize"
  | "error"
  | "killed"
  | "global_budget";

export type TraceKind =
  | "llm_call"
  | "tool_executed"
  | "tool_rejected"
  | "tool_error"
  | "reminder"
  | "terminal";

export interface TraceEntry {
  ts: number;
  step: number;
  kind: TraceKind;
  /** human-readable line, e.g. `research({"topic":"…"}) → 312 Zeichen` */
  detail: string;
  usage?: Usage;
  retries?: number;
}

export interface AgentState {
  itemId: string;
  itemName: string;
  status: ItemStatus;
  endReason?: EndReason;
  steps: number;
  strikes: number;
  usage: Usage;
  costUsd: number;
  lastAction?: string;
  /** output of the finalize tool, if the agent got there */
  result?: string;
  error?: string;
  trace: TraceEntry[];
}

// ---------- run ----------

export type RunMode = "mock" | "anthropic";
export type RunStatus = "running" | "completed" | "stopped";
export type StopReason = "budget" | "kill" | "fatal";

export interface RunConfig {
  mode: RunMode;
  concurrency: number;
  maxStepsPerAgent: number;
  maxTokensPerAgent: number;
  maxStrikes: number;
  /** hard per-LLM-call output cap, also the exact output part of each reservation */
  maxTokensPerCall: number;
  globalTokenBudget: number;
  items: BatchItem[];
}

export interface BudgetSnapshot {
  limit: number;
  used: number;
  reserved: number;
  /** highest observed used+reserved — the eval asserts peak <= limit */
  peak: number;
}

export interface RunState {
  id: string;
  status: RunStatus;
  stopReason?: StopReason;
  config: RunConfig;
  agents: Record<string, AgentState>;
  budget: BudgetSnapshot;
  costUsd: number;
  startedAt: number;
  endedAt?: number;
  /** scheduler high-water mark: max agents that were ever active at once */
  concurrencyPeak: number;
  resumedFrom?: string;
}

// ---------- events (SSE) ----------

export type RunEvent =
  | { type: "snapshot"; run: RunState }
  | { type: "run_update"; run: RunState }
  | { type: "agent_update"; runId: string; agent: AgentState; budget: BudgetSnapshot; costUsd: number };

// ---------- defaults ----------

export const DEFAULTS = {
  concurrency: 3,
  maxStepsPerAgent: 10,
  maxTokensPerAgent: 20_000,
  maxStrikes: 3,
  maxTokensPerCall: 1024,
  globalTokenBudget: 200_000,
} as const;
