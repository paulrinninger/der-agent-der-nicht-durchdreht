"use client";

import { memo } from "react";
import type { AgentState, BatchItem } from "@/src/types";
import { parseVerdict } from "./derive";
import { callCount, num, pillFor } from "./labels";

export function StatusPill({ agent }: { agent: AgentState }) {
  const p = pillFor(agent);
  return (
    // keyed by status: terminal pills pop in once
    <span key={agent.status} className={"pill pill-" + p.cls + (p.cls === "done" ? " pill-pop" : "")}>
      {agent.status === "running" ? <span className="pulse-dot" style={{ background: "currentColor" }} /> : null}
      {p.label}
    </span>
  );
}

function MiniBar({ value, max, danger }: { value: number; max: number; danger: boolean }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="minibar">
      <div className={"minibar-fill" + (danger ? " danger-fill" : "")} style={{ width: pct + "%" }} />
    </div>
  );
}

const AgentCard = memo(function AgentCard({
  agent,
  index,
  pitch,
  maxSteps,
  selected,
  onClick,
}: {
  agent: AgentState;
  index: number;
  pitch: string;
  maxSteps: number;
  selected: boolean;
  onClick: () => void;
}) {
  const p = pillFor(agent);
  const verdict = parseVerdict(agent.result);
  const last = agent.trace.length > 0 ? agent.trace[agent.trace.length - 1] : null;
  const lastText =
    agent.status === "running" && agent.lastAction ? agent.lastAction : (last?.detail ?? "");

  return (
    <button
      className={"card enter status-" + p.cls + (selected ? " selected" : "")}
      style={{ "--i": index } as React.CSSProperties}
      onClick={onClick}
      data-agent-id={agent.itemId}
    >
      <div className="card-top">
        <span className="card-id mono">{String(index + 1).padStart(2, "0")}</span>
        <StatusPill agent={agent} />
      </div>
      <h3 className="card-name">{agent.itemName}</h3>
      <p className="card-note">
        {verdict ? (
          <span className={verdict === "invest" ? "accent" : undefined} style={{ fontWeight: 600 }}>
            {verdict === "invest" ? "Urteil: Invest" : "Urteil: Pass"}
          </span>
        ) : (
          pitch
        )}
      </p>
      <div className="card-stats mono">
        <span title="Steps" data-tip={`Maximal ${maxSteps} Schritte pro Agent — dann zieht das Step-Cap die Notbremse.`}>
          {agent.steps}/{maxSteps} Steps
        </span>
        <span title="Tool-Calls">{callCount(agent)} Calls</span>
        {/* keyed remount: zahl blippt bei jeder token-änderung */}
        <span title="Tokens" key={agent.usage.inputTokens + agent.usage.outputTokens} className="blip-num">
          {num(agent.usage.inputTokens + agent.usage.outputTokens)} Tok
        </span>
        {agent.strikes > 0 && (
          <span className="danger" data-tip="Ungültige Tool-Calls. Drei Strikes, und der Agent wird gestoppt.">
            {agent.strikes} Strikes
          </span>
        )}
      </div>
      <MiniBar
        value={agent.steps}
        max={maxSteps}
        danger={agent.status === "failed" || agent.status === "aborted"}
      />
      <p className="card-last mono">{lastText}</p>
    </button>
  );
});

export const AgentRoster = memo(function AgentRoster({
  agents,
  items,
  maxSteps,
  selectedId,
  onSelect,
}: {
  agents: AgentState[];
  items: BatchItem[];
  maxSteps: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const pitchById = new Map(items.map((i) => [i.id, i.pitch]));
  return (
    <section className="grid" data-tour="grid">
      {agents.map((a, i) => (
        <AgentCard
          key={a.itemId}
          agent={a}
          index={i}
          pitch={pitchById.get(a.itemId) ?? ""}
          maxSteps={maxSteps}
          selected={selectedId === a.itemId}
          onClick={() => onSelect(a.itemId)}
        />
      ))}
    </section>
  );
});
