"use client";

import { memo, useMemo } from "react";
import type { RunState } from "@/src/types";
import { deriveEvents, formatT } from "./derive";

const CAP = 7;

/**
 * Kuratierte Vorfälle (aus dem Pipeline-Studio-Mockup „Letzte Ereignisse“):
 * nur die Guardrail-Momente — geblockt, gerettet, gestoppt. Die Telemetrie
 * unten bleibt die ungefilterte Firehose.
 */
export const EventFeed = memo(function EventFeed({ run }: { run: RunState }) {
  const items = useMemo(() => deriveEvents(run), [run]);
  const shown = items.slice(0, CAP);

  return (
    <section className="insight-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span
          className="label"
          data-tip="Nur die Guardrail-Momente: geblockte Tool-Calls, Retries, Stopps — neueste zuerst."
        >
          Letzte Ereignisse
        </span>
        <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
          {items.length} {items.length === 1 ? "Vorfall" : "Vorfälle"}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="feed-empty mono">Keine Vorfälle — alle Agenten im Rahmen.</p>
      ) : (
        <div className="feed-list">
          {shown.map((e) => (
            <div key={e.id} className="feed-row" {...(e.detail ? { "data-tip": e.detail } : {})}>
              <span className={"feed-dot feed-" + e.severity} />
              <span className="tr-t mono">{formatT(e.ts, run.startedAt)}</span>
              {e.agentName && <span className="feed-agent">{e.agentName}</span>}
              <span className="feed-text mono">{e.text}</span>
            </div>
          ))}
          {items.length > CAP && <p className="feed-more mono">+{items.length - CAP} weitere</p>}
        </div>
      )}
    </section>
  );
});
