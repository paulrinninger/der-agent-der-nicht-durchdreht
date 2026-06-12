"use client";

import type { AgentState } from "@/src/types";
import { parseVerdict } from "./derive";
import { END_REASON_LABEL, KIND_GLYPH, num, STATUS_LABEL } from "./labels";

export function TraceDrawer({
  agent,
  onClose,
}: {
  agent: AgentState;
  onClose: () => void;
}) {
  const verdict = parseVerdict(agent.result);
  return (
    <div className="fixed inset-0 z-50">
      {/* backdrop and sheet as SIBLINGS — Safari breaks nested backdrop-filter */}
      <div className="drawer-backdrop absolute inset-0" onClick={onClose} />
      <aside className="glass-sheet drawer-sheet absolute bottom-2 right-2 top-2 w-[min(32rem,calc(100vw-1rem))] overflow-y-auto p-5 sm:bottom-3 sm:right-3 sm:top-3">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">{agent.itemName}</h2>
            <p className="mt-0.5 font-mono text-xs text-ink-dim">
              {STATUS_LABEL[agent.status]}
              {agent.endReason ? ` · ${END_REASON_LABEL[agent.endReason]}` : ""} · {agent.steps}{" "}
              steps · {num(agent.usage.inputTokens)} in / {num(agent.usage.outputTokens)} out · $
              {agent.costUsd.toFixed(4)}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="btn h-11 w-11 rounded-full p-0 text-ink-dim"
          >
            ✕
          </button>
        </div>

        {agent.result && (
          <div className="mb-4 rounded-2xl border border-ok/20 bg-ok/[0.07] p-3 text-sm">
            {verdict && (
              <span
                className={`mr-2 inline-block rounded border px-1.5 font-display text-[11px] font-bold tracking-wider ${
                  verdict === "invest"
                    ? "border-ok/50 text-ok-soft"
                    : "border-white/20 text-ink-dim"
                }`}
              >
                {verdict.toUpperCase()}
              </span>
            )}
            {agent.result.replace(/^.*?—\s*/, "")}
          </div>
        )}

        <h3 className="font-display mb-2 text-[11px] uppercase tracking-[0.2em] text-ink-dim">
          agent-trace ({agent.trace.length} einträge)
        </h3>
        <ol className="space-y-2">
          {agent.trace.map((t, i) => (
            <li key={i} className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
              <p className="font-mono text-[11px] text-ink-dim">
                <span className="text-accent-soft">{KIND_GLYPH[t.kind]}</span> step {t.step} ·{" "}
                {t.kind}
                {t.usage ? ` · ${num(t.usage.inputTokens)} in / ${num(t.usage.outputTokens)} out` : ""}
                {t.retries ? ` · ${t.retries}× retry` : ""}
              </p>
              <p className="mt-1 break-words text-xs">{t.detail}</p>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
