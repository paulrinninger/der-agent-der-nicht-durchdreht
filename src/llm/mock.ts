import type { LLMClient, LLMRequest, LLMResponse, ToolCallProposal } from "./client";

/**
 * Deterministic mock LLM. No API key, no cost, no randomness.
 *
 * Each scenario is a fixed script keyed off the number of assistant turns so
 * far — so eval runs are exactly reproducible. The mock also honours the
 * AbortSignal so the kill switch interrupts "in-flight" mock calls just like
 * real HTTP requests.
 */

export interface MockOptions {
  /** simulated latency per call, so concurrency genuinely overlaps */
  delayMs?: number;
  /** fixed usage per call; eval uses this to hit small budgets predictably */
  usagePerCall?: { inputTokens: number; outputTokens: number };
}

let callSeq = 0;

export class MockLLMClient implements LLMClient {
  private readonly delayMs: number;
  private readonly usage: { inputTokens: number; outputTokens: number };

  constructor(opts: MockOptions = {}) {
    this.delayMs = opts.delayMs ?? 300;
    this.usage = opts.usagePerCall ?? { inputTokens: 220, outputTokens: 90 };
  }

  async chat(req: LLMRequest): Promise<LLMResponse> {
    await sleep(this.delayMs, req.signal);

    const turn = req.messages.filter((m) => m.role === "assistant").length;
    const topic = extractTopic(req);
    const scenario = req.scenario ?? "happy";

    if (scenario === "crasher" && turn >= 1) {
      throw new Error("mock: simulierter API-Ausfall (connection reset)");
    }

    const respond = (text: string, calls: ToolCallProposal[]): LLMResponse => ({
      text,
      toolCalls: calls,
      stopReason: calls.length > 0 ? "tool_use" : "end_turn",
      usage: { ...this.usage },
    });
    const call = (name: string, args: unknown): ToolCallProposal => ({
      id: `toolu_mock_${++callSeq}`,
      name,
      args,
    });

    // the happy pipeline: research -> draft -> critique -> finalize
    const happyStep = (step: number): LLMResponse => {
      switch (step) {
        case 0:
          return respond("Ich recherchiere den Markt.", [call("research", { topic })]);
        case 1:
          return respond("Ich schreibe eine Kurzbewertung.", [
            call("draft", { topic, insights: lastToolResult(req) }),
          ]);
        case 2:
          return respond("Ich lasse den Entwurf kritisieren.", [
            call("critique", { draft: lastToolResult(req) }),
          ]);
        default:
          return respond("Ich schließe ab.", [
            call("finalize", {
              summary: `${topic}: bewertet auf Basis von Recherche, Entwurf und Kritik. ${lastToolResult(req)}`,
              verdict: topic.length % 2 === 0 ? "invest" : "pass",
            }),
          ]);
      }
    };

    switch (scenario) {
      case "runaway":
        // never finalizes — the step cap has to stop this one
        return respond("Ich brauche noch mehr Daten!", [
          call("research", { topic: `${topic} — Detailfrage #${turn + 1}` }),
        ]);

      case "invented-tool":
        // proposes a tool that doesn't exist, then recovers after the error result
        if (turn === 0) {
          return respond("Ich beschwöre ein Einhorn.", [
            call("summon_unicorn", { wish: "Marktdaten per Magie" }),
          ]);
        }
        return happyStep(turn - 1);

      case "broken-args": {
        // schema-violating args in three flavours (wrong keys, a raw string
        // instead of an object, null) -> three strikes, agent is failed
        const garbage: unknown[] = [{ thema: 42, dringend: "ja" }, "{{{kein json", null];
        return respond("Ich recherchiere (irgendwie).", [call("research", garbage[turn % 3])]);
      }

      case "no-finalize":
        if (turn === 0) {
          return respond("Ich recherchiere kurz.", [call("research", { topic })]);
        }
        // ends turn without finalize — loop reminds once, then fails the agent
        return respond("Fertig! (glaube ich)", []);

      case "flaky-tool": // tool layer is flaky; the model itself behaves
      case "happy":
      default:
        return happyStep(turn);
    }
  }
}

function extractTopic(req: LLMRequest): string {
  const first = req.messages.find((m) => m.role === "user");
  const match = first && first.role === "user" ? first.text.match(/Startup: „(.+?)“/) : null;
  return match?.[1] ?? "Unbekanntes Startup";
}

function lastToolResult(req: LLMRequest): string {
  for (let i = req.messages.length - 1; i >= 0; i--) {
    const m = req.messages[i];
    if (m.role === "tool_results" && m.results.length > 0) {
      return m.results[m.results.length - 1].content.slice(0, 160);
    }
  }
  return "";
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(abortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function abortError(): Error {
  const err = new Error("aborted");
  err.name = "AbortError";
  return err;
}
