"use client";

import { memo } from "react";
import type { AgentState } from "@/src/types";
import { parseVerdict, PIPELINE, pipelineStages } from "./derive";
import { END_REASON_LABEL, num, STATUS_CHIP, STATUS_LABEL } from "./labels";

const STAGE_TIP: Record<(typeof PIPELINE)[number], string> = {
  research: "recherchiert fakten zur idee",
  draft: "schreibt das bewertungs-memo",
  critique: "zerpflückt den eigenen entwurf",
  finalize: "fällt das urteil: invest oder pass",
};

function PipelineDots({ agent }: { agent: AgentState }) {
  const stages = pipelineStages(agent);
  const activeIdx =
    agent.status === "running" ? PIPELINE.findIndex((s) => !stages[s]) : -1;
  return (
    <div className="pipe" aria-label={PIPELINE.join(" · ")}>
      {PIPELINE.map((s, i) => (
        <span key={s} className="flex items-center" data-tip={`${s} — ${STAGE_TIP[s]}`}>
          {i > 0 && <span className="pipe-line" />}
          <span
            className={`pipe-dot ${
              stages[s]
                ? "pipe-dot-done"
                : agent.status === "failed" && i === activeFailIdx(agent, stages)
                  ? "pipe-dot-fail"
                  : i === activeIdx
                    ? "pipe-dot-active"
                    : ""
            }`}
          />
        </span>
      ))}
    </div>
  );
}

function activeFailIdx(
  agent: AgentState,
  stages: Record<(typeof PIPELINE)[number], boolean>,
): number {
  return PIPELINE.findIndex((s) => !stages[s]);
}

export const AgentCard = memo(function AgentCard({
  agent,
  index,
  maxSteps,
  onClick,
}: {
  agent: AgentState;
  index: number;
  maxSteps: number;
  onClick: () => void;
}) {
  const verdict = parseVerdict(agent.result);
  const summary = agent.result?.replace(/^.*?—\s*/, "");
  const guardFired = agent.status === "failed" || agent.status === "aborted";

  return (
    <button
      onClick={onClick}
      className={`glass lift enter relative flex h-full flex-col items-start p-4 text-left ${agent.status === "running" ? "is-running" : ""}`}
      style={{ "--i": index } as React.CSSProperties}
      data-agent-id={agent.itemId}
    >
      {verdict && (
        <span
          className={`stamp stamp-in ${verdict === "invest" ? "stamp-invest" : "stamp-pass"}`}
          data-tip={verdict === "invest" ? "der agent würde investieren" : "der agent winkt ab"}
        >
          {verdict === "invest" ? "INVEST" : "PASS"}
        </span>
      )}
      <div className="flex w-full items-start justify-between gap-2">
        <PipelineDots agent={agent} />
        {!verdict && (
          <span className={`${STATUS_CHIP[agent.status]} shrink-0`}>
            {STATUS_LABEL[agent.status]}
          </span>
        )}
      </div>
      <h3 className="mt-2 pr-16 text-sm font-semibold leading-tight">{agent.itemName}</h3>
      <p className="mt-1.5 font-mono text-[11px] text-ink-dim">
        <span data-tip={`jeder agent darf maximal ${maxSteps} schritte — dann zieht das step-limit die notbremse.`}>
          step {agent.steps}/{maxSteps}
        </span>
        {agent.strikes > 0 && (
          <span className="text-err-soft" data-tip="ungültige tool-calls. drei strikes, und der agent wird gestoppt.">
            {" "}
            · {agent.strikes} strikes
          </span>
        )}
        {" · "}
        {num(agent.usage.inputTokens + agent.usage.outputTokens)} tok · ${agent.costUsd.toFixed(4)}
      </p>
      {agent.status === "running" && agent.lastAction && (
        <p className="shimmer mt-1.5 truncate font-mono text-[11px]">{agent.lastAction}</p>
      )}
      {guardFired && agent.endReason && (
        <p className="fuse mt-2">
          ⚡ sicherung ausgelöst · {END_REASON_LABEL[agent.endReason]}
        </p>
      )}
      {verdict && summary && (
        <p className="mt-1.5 line-clamp-2 text-xs text-ink-dim">{summary}</p>
      )}
    </button>
  );
});

export const AgentRoster = memo(function AgentRoster({
  agents,
  maxSteps,
  onSelect,
}: {
  agents: AgentState[];
  maxSteps: number;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="grid grid-cols-1 gap-3 sm:auto-rows-fr sm:grid-cols-2">
      {agents.map((a, i) => (
        <AgentCard
          key={a.itemId}
          agent={a}
          index={i}
          maxSteps={maxSteps}
          onClick={() => onSelect(a.itemId)}
        />
      ))}
    </section>
  );
});
