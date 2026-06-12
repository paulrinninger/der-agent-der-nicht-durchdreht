import {
  estimateRequestTokens,
  type AgentMessage,
  type LLMClient,
  type LLMResponse,
  type ToolResultMessage,
} from "../llm/client";
import { costUsd } from "../llm/pricing";
import { TokenBudget } from "../orchestrator/budget";
import { TERMINAL_TOOL } from "../tools/definitions";
import type { ToolRegistry } from "../tools/registry";
import {
  addUsage,
  totalTokens,
  ZERO_USAGE,
  type AgentState,
  type BatchItem,
  type EndReason,
  type ItemStatus,
  type RunConfig,
  type TraceEntry,
} from "../types";

/**
 * One agent = one item. The model decides which tools to call in which order
 * and when it is done (by calling `finalize`). This loop enforces the guard
 * rails around that freedom; every way out of the loop is an explicit
 * terminal state — there is no path that loops forever or throws upwards.
 *
 * Per-step gate order:
 *   stop flag -> step cap -> per-agent budget reserve -> global budget
 *   reserve -> LLM call -> commit -> validate & execute tool calls
 */

export interface AgentLoopOptions {
  item: BatchItem;
  config: RunConfig;
  llm: LLMClient;
  registry: ToolRegistry;
  globalBudget: TokenBudget;
  /** hard abort (manual kill) — also cancels in-flight HTTP/mock calls */
  signal: AbortSignal;
  /** soft stop (budget exhausted / kill) — honoured at the next step boundary */
  isStopped: () => boolean;
  /** why the run is stopping, to pick the right endReason */
  externalEndReason: () => Extract<EndReason, "killed" | "global_budget">;
  /** first failed global reservation flips the run-wide kill switch */
  onGlobalBudgetExhausted: () => void;
  /** live updates for the dashboard/eval after every state change */
  onUpdate: (agent: AgentState) => void;
}

const SYSTEM_PROMPT = `Du bist ein Analyse-Agent für absurde Startup-Ideen.
Arbeite mit deinen Tools: research liefert Marktdaten, draft schreibt eine Kurzbewertung, critique prüft sie.
Du entscheidest selbst über Reihenfolge und Anzahl der Schritte — aber dein letzter Schritt MUSS das Tool finalize sein, damit dein Ergebnis gewertet wird.
Antworte knapp, höchstens ein Tool-Call pro Antwort.`;

export async function runAgentLoop(opts: AgentLoopOptions): Promise<AgentState> {
  const { item, config, llm, registry, globalBudget } = opts;

  const agent: AgentState = {
    itemId: item.id,
    itemName: item.name,
    status: "running",
    steps: 0,
    strikes: 0,
    usage: { ...ZERO_USAGE },
    costUsd: 0,
    trace: [],
  };

  const agentBudget = new TokenBudget(config.maxTokensPerAgent);
  const messages: AgentMessage[] = [
    {
      role: "user",
      text: `Startup: „${item.name}“ — ${item.pitch}\nBewerte diese Idee und schließe mit finalize ab.`,
    },
  ];
  let reminded = false;

  const trace = (kind: TraceEntry["kind"], detail: string, extra?: Partial<TraceEntry>): void => {
    agent.trace.push({ ts: Date.now(), step: agent.steps, kind, detail, ...extra });
  };

  const finish = (status: ItemStatus, endReason: EndReason, detail?: string): AgentState => {
    agent.status = status;
    agent.endReason = endReason;
    if (detail) agent.error = detail;
    trace("terminal", detail ?? `${status}/${endReason}`);
    opts.onUpdate(agent);
    return agent;
  };

  try {
    while (true) {
      // gate 1: external stop (kill switch or exhausted global budget)
      if (opts.isStopped() || opts.signal.aborted) {
        return finish("aborted", opts.externalEndReason(), "Extern gestoppt");
      }
      // gate 2: hard step cap — no agent loops forever
      if (agent.steps >= config.maxStepsPerAgent) {
        return finish("failed", "step_cap", `Step-Cap erreicht (${config.maxStepsPerAgent})`);
      }
      // gates 3+4: reserve before the call — never issue a call that could
      // take the agent or the run over budget
      const estimate = estimateRequestTokens({ system: SYSTEM_PROMPT, messages }, config.maxTokensPerCall);
      if (!agentBudget.reserve(estimate)) {
        return finish("failed", "token_cap", `Agent-Token-Cap erreicht (${config.maxTokensPerAgent})`);
      }
      if (!globalBudget.reserve(estimate)) {
        agentBudget.release(estimate);
        opts.onGlobalBudgetExhausted();
        return finish("aborted", "global_budget", "Globales Token-Budget erschöpft");
      }

      agent.steps++;
      agent.lastAction = "LLM-Call…";
      opts.onUpdate(agent);

      let res: LLMResponse;
      try {
        res = await llm.chat({
          system: SYSTEM_PROMPT,
          messages,
          tools: registry.specs,
          maxTokens: config.maxTokensPerCall,
          signal: opts.signal,
          scenario: item.scenario,
        });
      } catch (err) {
        agentBudget.release(estimate);
        globalBudget.release(estimate);
        if (opts.signal.aborted) {
          return finish("aborted", opts.externalEndReason(), "Während LLM-Call abgebrochen");
        }
        // SDK retries (429/5xx) are exhausted at this point — this agent dies,
        // its siblings keep running
        return finish("failed", "error", `LLM-Fehler: ${message(err)}`);
      }

      const actual = totalTokens(res.usage);
      agentBudget.commit(estimate, actual);
      globalBudget.commit(estimate, actual);
      agent.usage = addUsage(agent.usage, res.usage);
      agent.costUsd = costUsd(agent.usage);
      trace("llm_call", res.text || "(kein Text)", { usage: res.usage });

      // model ended its turn without finalize: remind once, then fail
      if (res.toolCalls.length === 0) {
        messages.push({ role: "assistant", text: res.text, toolCalls: [] });
        if (!reminded) {
          reminded = true;
          messages.push({
            role: "user",
            text: "Du bist noch nicht fertig: Rufe das Tool finalize mit deiner Zusammenfassung auf.",
          });
          trace("reminder", "end_turn ohne finalize — einmalige Erinnerung");
          opts.onUpdate(agent);
          continue;
        }
        return finish("failed", "no_finalize", "Turn zweimal ohne finalize beendet");
      }

      messages.push({ role: "assistant", text: res.text, toolCalls: res.toolCalls });

      // validate-then-execute; EVERY tool_use id gets exactly one tool_result
      const results: ToolResultMessage[] = [];
      let finalResult: string | null = null;

      for (const call of res.toolCalls) {
        const v = registry.validate(call.name, call.args);
        if (!v.ok) {
          agent.strikes++;
          results.push({
            toolUseId: call.id,
            content: `${v.error} (Strike ${agent.strikes}/${config.maxStrikes})`,
            isError: true,
          });
          trace("tool_rejected", `${call.name}(${safeJson(call.args)}) → ${v.error}`);
          agent.lastAction = `❌ ${call.name} abgelehnt`;
          continue;
        }
        try {
          const { result, retries } = await registry.execute(v.def, v.parsed, item, opts.signal);
          results.push({ toolUseId: call.id, content: result, isError: false });
          trace("tool_executed", `${v.def.name}(${safeJson(call.args)}) → ${result.slice(0, 120)}`, { retries });
          agent.lastAction = `${v.def.name}()${retries > 0 ? ` (${retries}× Retry)` : ""}`;
          if (v.def.name === TERMINAL_TOOL) finalResult = result;
        } catch (err) {
          // a tool that keeps failing is not the agent's fault — no strike,
          // the error goes back to the model so it can adapt
          results.push({ toolUseId: call.id, content: `Tool-Fehler: ${message(err)}`, isError: true });
          trace("tool_error", `${v.def.name} → ${message(err)}`);
          agent.lastAction = `⚠️ ${v.def.name} fehlgeschlagen`;
        }
      }

      messages.push({ role: "tool_results", results });
      opts.onUpdate(agent);

      if (finalResult !== null) {
        agent.result = finalResult;
        return finish("completed", "finalized");
      }
      if (agent.strikes >= config.maxStrikes) {
        return finish("failed", "strikes", `${agent.strikes} ungültige Tool-Calls`);
      }
    }
  } catch (err) {
    // belt & braces: nothing above should throw, but isolation must hold even
    // if it does — the worker slot is freed and siblings continue
    return finish("failed", "error", `Unerwarteter Fehler: ${message(err)}`);
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function safeJson(v: unknown): string {
  try {
    const s = JSON.stringify(v);
    return s.length > 120 ? s.slice(0, 120) + "…" : s;
  } catch {
    return "<nicht serialisierbar>";
  }
}
