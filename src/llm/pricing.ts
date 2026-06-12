import type { Usage } from "../types";

export const MODEL_ID = "claude-haiku-4-5";

/** USD per million tokens (claude-haiku-4-5) */
export const PRICE_PER_MTOK = { input: 1.0, output: 5.0 } as const;

export function costUsd(u: Usage): number {
  return (u.inputTokens * PRICE_PER_MTOK.input + u.outputTokens * PRICE_PER_MTOK.output) / 1_000_000;
}
