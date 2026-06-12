import type { MockScenario, Usage } from "../types";

/**
 * Neutral LLM abstraction. Both the real Anthropic client and the
 * deterministic mock implement this — the agent loop never knows which
 * one it talks to.
 */

export interface ToolCallProposal {
  id: string;
  name: string;
  /** args exactly as proposed by the model — any shape, validated by the registry */
  args: unknown;
}

export interface ToolResultMessage {
  toolUseId: string;
  content: string;
  isError: boolean;
}

export type AgentMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; toolCalls: ToolCallProposal[] }
  | { role: "tool_results"; results: ToolResultMessage[] };

export interface LLMToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface LLMRequest {
  system: string;
  messages: AgentMessage[];
  tools: LLMToolSpec[];
  maxTokens: number;
  signal?: AbortSignal;
  /** mock-only steering; the Anthropic client ignores it */
  scenario?: MockScenario;
}

export interface LLMResponse {
  text: string;
  toolCalls: ToolCallProposal[];
  stopReason: "tool_use" | "end_turn" | "max_tokens";
  usage: Usage;
}

export interface LLMClient {
  chat(req: LLMRequest): Promise<LLMResponse>;
}

/**
 * Upper-bound token estimate for one call, used for budget reservations.
 * Output side is exact (maxTokens is a hard API cap); input side is a
 * generous chars/3 heuristic so the reservation stays an upper bound.
 */
export function estimateRequestTokens(
  req: { system: string; messages: AgentMessage[] },
  maxTokens: number,
): number {
  let chars = req.system.length;
  for (const m of req.messages) {
    if (m.role === "user") chars += m.text.length;
    else if (m.role === "assistant") chars += m.text.length + JSON.stringify(m.toolCalls).length;
    else chars += m.results.reduce((n, r) => n + r.content.length + 40, 0);
  }
  // tool specs travel with every request too — flat allowance
  chars += 2_000;
  return Math.ceil(chars / 3) + maxTokens;
}
