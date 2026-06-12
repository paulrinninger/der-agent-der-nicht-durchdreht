"use client";

import { memo, useRef, useState } from "react";
import { formatT } from "./derive";
import type { TickerEntry } from "./hooks";
import { KIND_GLYPH } from "./labels";

const GLYPH_COLOR: Record<string, string> = {
  llm_call: "text-ink-dim",
  tool_executed: "text-accent-soft",
  tool_rejected: "text-err-soft",
  tool_error: "text-warn-soft",
  reminder: "text-warn-soft",
  terminal: "text-ink-dim",
};

/**
 * Live telemetry: every tool call across all agents, newest on top.
 * Hover freezes a snapshot (zero DOM churn while reading) and shows how many
 * new lines arrived in the meantime.
 */
export const Ticker = memo(function Ticker({
  entries,
  startedAt,
  live,
}: {
  entries: TickerEntry[];
  startedAt: number;
  live: boolean;
}) {
  const [paused, setPaused] = useState(false);
  const frozen = useRef<TickerEntry[]>([]);

  const shown = paused ? frozen.current : entries;
  const newCount = paused
    ? entries.filter((e) => e.id > (frozen.current[0]?.id ?? -1)).length
    : 0;

  return (
    <section
      className="glass flex max-h-[min(30rem,calc(100dvh-2rem))] flex-col overflow-hidden"
      data-tour="ticker"
      onPointerEnter={() => {
        frozen.current = entries;
        setPaused(true);
      }}
      onPointerLeave={() => {
        setPaused(false);
        frozen.current = [];
      }}
    >
      <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
        <h2 className="font-display text-[11px] uppercase tracking-[0.2em] text-ink-dim">
          telemetrie
        </h2>
        {paused ? (
          <span className="chip chip-aborted">pausiert{newCount > 0 ? ` · +${newCount} neu` : ""}</span>
        ) : (
          live && (
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-accent-soft">
              <span className="pipe-dot pipe-dot-active h-1.5 w-1.5" />
              live
            </span>
          )
        )}
      </div>
      <ol className="min-h-[8rem] overflow-y-auto pb-2">
        {shown.length === 0 ? (
          <li className="px-4 py-6 font-mono text-[11px] text-ink-dim/50">
            noch keine tool-calls — starte einen batch.
          </li>
        ) : (
          shown.map((e) => (
            <li
              key={e.id}
              className={`tick-row ${e.backfill || paused ? "" : "tick-in"} ${
                e.kind === "tool_rejected" || e.kind === "tool_error" ? "tick-err" : ""
              }`}
            >
              <span className="text-ink-dim/60">{formatT(e.ts, startedAt)}</span>
              <span className="truncate text-ink-dim" title={e.agentName}>
                {e.agentName.toLowerCase()}
              </span>
              <span className={GLYPH_COLOR[e.kind] ?? "text-ink-dim"}>{KIND_GLYPH[e.kind]}</span>
              <span className="truncate" title={e.detail}>
                {e.detail}
              </span>
            </li>
          ))
        )}
      </ol>
    </section>
  );
});
