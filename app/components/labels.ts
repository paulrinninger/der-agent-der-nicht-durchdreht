import type { AgentState, EndReason, RunConfig, TraceKind } from "@/src/types";

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

/** trace kind -> drawer column tag (uppercase mono badge) */
export const TRACE_TAG: Record<TraceKind, string> = {
  llm_call: "LLM",
  tool_executed: "TOOL ✓",
  tool_rejected: "GEBLOCKT",
  tool_error: "FEHLER",
  reminder: "INFO",
  terminal: "ENDE",
};

/** „Was ist passiert?“ — Klartext je Stopp-Grund, mit Config-Werten interpoliert */
export const WHY_TEXT: Record<EndReason, (cfg: RunConfig) => string> = {
  finalized: () => "Der Agent hat seine Analyse regulär mit finalize abgeschlossen.",
  step_cap: (cfg) =>
    `Der Agent hat alle ${cfg.maxStepsPerAgent} Schritte verbraucht, ohne finalize aufzurufen — ein klassischer Runaway-Loop. Das Step-Cap hat ihn gestoppt, bevor er weiter Budget verbrennt.`,
  token_cap: (cfg) =>
    `Der Agent hat sein persönliches Token-Budget von ${num(cfg.maxTokensPerAgent)} Tokens aufgebraucht, bevor ein Urteil zustande kam. Das Token-Cap hat ihn isoliert gestoppt — der Rest des Batches war nie in Gefahr.`,
  strikes: (cfg) =>
    `${cfg.maxStrikes} Tool-Calls waren ungültig — erfundene Tools oder Argumente, die das Schema verletzen. Jeder wurde vor der Ausführung abgefangen; nach ${cfg.maxStrikes} Strikes wird gestoppt statt endlos korrigiert.`,
  no_finalize: () =>
    "Der Agent hat seinen Turn zweimal beendet, ohne finalize aufzurufen — trotz einmaliger Erinnerung. Ohne finalize gibt es kein wertbares Ergebnis, also wurde er gestoppt.",
  error: () =>
    "Der LLM-Call selbst ist fehlgeschlagen, auch nach den automatischen Retries. Der Agent wurde isoliert beendet — seine Geschwister liefen ungestört weiter.",
  killed: () =>
    "Der Lauf wurde von außen gestoppt (Kill-Switch). Der Agent hat nichts falsch gemacht — „Fortsetzen“ startet ihn neu, ohne fertige Agenten doppelt zu bezahlen.",
  global_budget: (cfg) =>
    `Das globale Token-Budget (${num(cfg.globalTokenBudget)}) war erschöpft, bevor dieser Agent seinen nächsten Call reservieren konnte. Der Lauf wurde sauber gestoppt — kein Call hat das Limit gerissen.`,
};

/** „Nächste Schritte“ — eine Handlungszeile je Stopp-Grund */
export const NEXT_STEP_TEXT: Record<EndReason, (cfg: RunConfig) => string> = {
  finalized: () => "Nichts zu tun — das Urteil steht.",
  step_cap: (cfg) =>
    `Prompt/Agenten-Logik prüfen (Loop?) oder Step-Cap anpassen (aktuell ${cfg.maxStepsPerAgent}).`,
  token_cap: (cfg) =>
    `Knapperen Prompt versuchen oder Token-Cap pro Agent erhöhen (aktuell ${num(cfg.maxTokensPerAgent)}).`,
  strikes: (cfg) =>
    `Tool-Beschreibungen im Prompt schärfen — oder Strike-Limit anpassen (aktuell ${cfg.maxStrikes}).`,
  no_finalize: () => "System-Prompt schärfen: finalize als Pflicht-Abschluss deutlicher machen.",
  error: () =>
    "Letzte Fehlermeldung im Trace prüfen — bei echten Läufen API-Status/Key checken, dann „Fortsetzen“.",
  killed: () => "„Fortsetzen“ startet nur die unfertigen Agenten neu.",
  global_budget: (cfg) =>
    `Budget erhöhen (aktuell ${num(cfg.globalTokenBudget)}) und „Fortsetzen“ — fertige Agenten werden nicht doppelt bezahlt.`,
};

/** tool calls = executed + rejected + errored entries in the trace */
export function callCount(agent: AgentState): number {
  return agent.trace.filter(
    (t) => t.kind === "tool_executed" || t.kind === "tool_rejected" || t.kind === "tool_error",
  ).length;
}
