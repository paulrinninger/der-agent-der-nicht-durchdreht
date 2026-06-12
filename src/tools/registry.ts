import { z } from "zod";
import type { LLMToolSpec } from "../llm/client";
import type { BatchItem } from "../types";
import type { ToolContext, ToolDefinition } from "./definitions";

/**
 * Validate-then-execute. The model only ever *proposes* tool calls — this
 * registry decides whether they run:
 *   - unknown tool      -> rejected (strike), error result back to the model
 *   - schema-violating  -> rejected (strike), error result back to the model
 *   - throwing tool     -> retried with backoff, then error result (no strike:
 *                          a broken tool is not the agent's fault)
 */

export type ValidationResult =
  | { ok: true; def: ToolDefinition; parsed: unknown }
  | { ok: false; error: string };

export interface RetryOptions {
  /** total attempts including the first one */
  attempts: number;
  baseDelayMs: number;
}

export interface ExecutionSuccess {
  result: string;
  /** how many retries it took (0 = first attempt succeeded) */
  retries: number;
}

export class ToolRegistry {
  private readonly byName = new Map<string, ToolDefinition>();
  readonly specs: LLMToolSpec[];

  constructor(
    defs: ToolDefinition[],
    private readonly retry: RetryOptions = { attempts: 3, baseDelayMs: 50 },
  ) {
    for (const d of defs) this.byName.set(d.name, d);
    this.specs = defs.map((d) => {
      const { $schema: _omit, ...schema } = z.toJSONSchema(d.schema) as Record<string, unknown>;
      return { name: d.name, description: d.description, inputSchema: schema };
    });
  }

  validate(name: string, args: unknown): ValidationResult {
    const def = this.byName.get(name);
    if (!def) {
      return {
        ok: false,
        error: `Unbekanntes Tool „${name}“. Verfügbar: ${[...this.byName.keys()].join(", ")}.`,
      };
    }
    const parsed = def.schema.safeParse(args);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i: z.core.$ZodIssue) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`)
        .join("; ");
      return { ok: false, error: `Ungültige Argumente für „${name}“: ${issues}` };
    }
    return { ok: true, def, parsed: parsed.data };
  }

  /** Executes a validated call with exponential backoff for transient failures. */
  async execute(
    def: ToolDefinition,
    parsed: unknown,
    item: BatchItem,
    signal?: AbortSignal,
  ): Promise<ExecutionSuccess> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < this.retry.attempts; attempt++) {
      if (signal?.aborted) throw lastErr ?? new Error("aborted");
      try {
        const ctx: ToolContext = { item, attempt };
        return { result: def.execute(parsed, ctx), retries: attempt };
      } catch (err) {
        lastErr = err;
        if (attempt < this.retry.attempts - 1) {
          await new Promise((r) => setTimeout(r, this.retry.baseDelayMs * 2 ** attempt));
        }
      }
    }
    throw lastErr;
  }
}
