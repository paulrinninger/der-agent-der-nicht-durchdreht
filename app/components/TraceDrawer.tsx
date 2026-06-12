"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentState, RunConfig, TraceKind } from "@/src/types";
import { formatT } from "./derive";
import { StatusPill } from "./AgentRoster";
import { callCount, NEXT_STEP_TEXT, num, TRACE_CLS, TRACE_TAG, WHY_TEXT } from "./labels";

type Filter = "alle" | "llm" | "tools" | "probleme";

const FILTER_LABEL: Record<Filter, string> = {
  alle: "Alle",
  llm: "LLM",
  tools: "Tools",
  probleme: "Probleme",
};

const FILTER_KINDS: Record<Exclude<Filter, "alle">, TraceKind[]> = {
  llm: ["llm_call"],
  tools: ["tool_executed"],
  probleme: ["tool_rejected", "tool_error", "reminder"],
};

/** terminal-einträge passieren jeden filter — das ende zählt immer */
function passes(filter: Filter, kind: TraceKind): boolean {
  if (filter === "alle" || kind === "terminal") return true;
  return FILTER_KINDS[filter].includes(kind);
}

/** Agent-Trace im Drawer-Stil des Design-Mockups: t-Zeit + Tag + farbcodierte Zeilen. */
export function TraceDrawer({
  agent,
  index,
  startedAt,
  config,
  onClose,
}: {
  agent: AgentState;
  index: number;
  startedAt: number;
  config: RunConfig;
  onClose: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<Filter>("alle");
  const len = agent.trace.length;

  // drawer bleibt beim agentenwechsel gemountet — filter zurücksetzen
  useEffect(() => {
    setFilter("alle");
  }, [agent.itemId]);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [len, agent.itemId, filter]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const stopped = (agent.status === "failed" || agent.status === "aborted") && agent.endReason;
  const countFor = (f: Exclude<Filter, "alle">) =>
    agent.trace.filter((t) => FILTER_KINDS[f].includes(t.kind)).length;
  const lastTs = len > 0 ? agent.trace[len - 1].ts : startedAt;

  return (
    <div className="fixed inset-0 z-50">
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Agent-Trace">
        <header className="drawer-head">
          <div>
            <span className="label">Agent-Trace · {String(index + 1).padStart(2, "0")}</span>
            <h2 className="drawer-title">{agent.itemName}</h2>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>
            Schließen
          </button>
        </header>
        <div className="drawer-stats mono">
          <span>
            <StatusPill agent={agent} />
          </span>
          <span>
            {agent.steps}/{config.maxStepsPerAgent} Steps
          </span>
          <span>{callCount(agent)} Calls</span>
          <span>{num(agent.usage.inputTokens + agent.usage.outputTokens)} Tokens</span>
          <span>${agent.costUsd.toFixed(4)}</span>
        </div>
        {stopped && agent.endReason && (
          <div className={"why-box " + (agent.status === "failed" ? "why-warn" : "why-danger")}>
            <span className="label">Was ist passiert?</span>
            <p>{WHY_TEXT[agent.endReason](config)}</p>
            <p className="why-next mono">→ {NEXT_STEP_TEXT[agent.endReason](config)}</p>
          </div>
        )}
        <div className="drawer-filter">
          <div className="seg" role="tablist" aria-label="Trace filtern">
            {(["alle", "llm", "tools", "probleme"] as const).map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                className={"seg-btn" + (filter === f ? " active" : "")}
                onClick={() => setFilter(f)}
              >
                {FILTER_LABEL[f]}
                <span className="seg-count">{f === "alle" ? len : countFor(f)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="drawer-body" ref={bodyRef}>
          {agent.result && (
            <div className="tr-line tr-done">
              <span className="tr-t mono">{formatT(lastTs, startedAt)}</span>
              <span className="tr-tag">URTEIL</span>
              <span className="tr-text mono">{agent.result.replace(/^.*?—\s*/, "")}</span>
            </div>
          )}
          {agent.trace.map((t, i) =>
            passes(filter, t.kind) ? (
              <div className={"tr-line " + (TRACE_CLS[t.kind] ?? "tr-info")} key={i}>
                <span className="tr-t mono">{formatT(t.ts, startedAt)}</span>
                <span className="tr-tag">{TRACE_TAG[t.kind]}</span>
                <span className="tr-text mono">
                  {t.detail}
                  {t.retries ? ` · ${t.retries}× Retry` : ""}
                </span>
              </div>
            ) : null,
          )}
        </div>
      </aside>
    </div>
  );
}
