"use client";

import { useEffect, useRef } from "react";
import type { AgentState } from "@/src/types";
import { formatT } from "./derive";
import { StatusPill } from "./AgentRoster";
import { callCount, num, TRACE_CLS } from "./labels";

/** Agent-Trace im Drawer-Stil des Design-Mockups: t-Zeit + farbcodierte Zeilen. */
export function TraceDrawer({
  agent,
  index,
  startedAt,
  maxSteps,
  onClose,
}: {
  agent: AgentState;
  index: number;
  startedAt: number;
  maxSteps: number;
  onClose: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const len = agent.trace.length;
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [len, agent.itemId]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

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
            {agent.steps}/{maxSteps} Steps
          </span>
          <span>{callCount(agent)} Calls</span>
          <span>{num(agent.usage.inputTokens + agent.usage.outputTokens)} Tokens</span>
          <span>${agent.costUsd.toFixed(4)}</span>
        </div>
        <div className="drawer-body" ref={bodyRef}>
          {agent.result && (
            <div className="tr-line tr-done">
              <span className="tr-t mono">Urteil</span>
              <span className="tr-text mono">{agent.result.replace(/^.*?—\s*/, "")}</span>
            </div>
          )}
          {agent.trace.map((t, i) => (
            <div className={"tr-line " + (TRACE_CLS[t.kind] ?? "tr-info")} key={i}>
              <span className="tr-t mono">{formatT(t.ts, startedAt)}</span>
              <span className="tr-text mono">
                {t.detail}
                {t.retries ? ` · ${t.retries}× Retry` : ""}
              </span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
