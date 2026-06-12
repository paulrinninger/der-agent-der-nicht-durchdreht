import Anthropic from "@anthropic-ai/sdk";
import type {
  AgentMessage,
  LLMClient,
  LLMRequest,
  LLMResponse,
  ToolCallProposal,
} from "./client";
import { MODEL_ID } from "./pricing";

/**
 * Real client (claude-haiku-4-5) using the manual tool-use shape: the model
 * only PROPOSES tool calls — execution and validation stay in our registry.
 * The SDK retries 429/5xx with backoff on its own (maxRetries); req.signal
 * aborts in-flight HTTP when the kill switch fires. `req.scenario` is
 * mock-only and deliberately ignored here.
 */
export class AnthropicLLMClient implements LLMClient {
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({ maxRetries: 3 });
  }

  async chat(req: LLMRequest): Promise<LLMResponse> {
    const response = await this.client.messages.create(
      {
        model: MODEL_ID,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: req.messages.map(toAnthropicMessage),
        tools: req.tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
        })),
      },
      { signal: req.signal },
    );

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const toolCalls: ToolCallProposal[] = response.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
      .map((b) => ({ id: b.id, name: b.name, args: b.input }));

    return {
      text,
      toolCalls,
      stopReason:
        response.stop_reason === "tool_use"
          ? "tool_use"
          : response.stop_reason === "max_tokens"
            ? "max_tokens"
            : "end_turn",
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}

function toAnthropicMessage(m: AgentMessage): Anthropic.MessageParam {
  switch (m.role) {
    case "user":
      return { role: "user", content: m.text };
    case "assistant": {
      const content: Anthropic.ContentBlockParam[] = [];
      if (m.text) content.push({ type: "text", text: m.text });
      for (const c of m.toolCalls) {
        content.push({
          type: "tool_use",
          id: c.id,
          name: c.name,
          input: c.args as Record<string, unknown>,
        });
      }
      // the API rejects empty content arrays
      if (content.length === 0) content.push({ type: "text", text: "…" });
      return { role: "assistant", content };
    }
    case "tool_results":
      return {
        role: "user",
        content: m.results.map((r) => ({
          type: "tool_result" as const,
          tool_use_id: r.toolUseId,
          content: r.content,
          is_error: r.isError,
        })),
      };
  }
}
