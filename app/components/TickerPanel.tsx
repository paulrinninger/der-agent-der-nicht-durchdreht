"use client";

import { memo, useRef, useState } from "react";
import { formatT } from "./derive";
import type { TickerEntry } from "./hooks";
import { TRACE_CLS } from "./labels";

/**
 * Live-Telemetrie (zurückgeholt): jeder Tool-Call aller Agenten als Zeile,
 * neueste oben. Hover pausiert den Feed; abgelehnte Calls flashen rot.
 */
export const TickerPanel = memo(function TickerPanel({
  entries,
  startedAt,
  live,
}: {
  entries: TickerEntry[];
  startedAt: number;
  live: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [paused, setPaused] = useState(false);
  const frozen = useRef<TickerEntry[]>([]);

  const shown = paused ? frozen.current : entries;
  const newCount = paused
    ? entries.filter((e) => e.id > (frozen.current[0]?.id ?? -1)).length
    : 0;

  if (entries.length === 0) return null;

  return (
    <section
      className="ticker-panel"
      data-tour="telemetrie"
      onPointerEnter={() => {
        frozen.current = entries;
        setPaused(true);
      }}
      onPointerLeave={() => {
        setPaused(false);
        frozen.current = [];
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-baseline justify-between gap-3 text-left"
        style={{ background: "none", border: "none", cursor: "pointer", font: "inherit", color: "inherit", padding: 0 }}
        aria-expanded={open}
      >
        <span className="label">Telemetrie {open ? "▾" : "▸"}</span>
        {paused ? (
          <span className="mono" style={{ fontSize: 12, color: "var(--warn)" }}>
            pausiert{newCount > 0 ? ` · +${newCount} neu` : ""}
          </span>
        ) : live ? (
          <span className="live-dot mono">
            <span className="pulse-dot" /> live
          </span>
        ) : (
          <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
            {entries.length} Einträge
          </span>
        )}
      </button>
      {open && (
        <>
          <p className="caption" style={{ margin: "6px 0 0" }}>
            Alle Tool-Calls aller Agenten, live — neueste oben. Hover pausiert den Feed.
          </p>
          <div className="ticker-list">
            {shown.map((e) => (
              <div
                key={e.id}
                className={
                  "tr-line " +
                  (TRACE_CLS[e.kind] ?? "tr-info") +
                  (e.backfill || paused ? "" : " tick-in") +
                  (e.kind === "tool_rejected" || e.kind === "tool_error" ? " tick-flash" : "")
                }
              >
                <span className="tr-t mono">{formatT(e.ts, startedAt)}</span>
                <span className="tr-t mono" style={{ width: "9rem", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {e.agentName}
                </span>
                <span className="tr-text mono" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {e.detail}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
});
