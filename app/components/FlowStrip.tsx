"use client";

import { memo } from "react";

/** the system map in one line — items → queue → slots → verdict, budget on guard */
export const FlowStrip = memo(function FlowStrip({
  itemCount,
  concurrency,
}: {
  itemCount: number;
  concurrency: number;
}) {
  return (
    <nav
      aria-label="so funktioniert ein lauf"
      className="enter mb-6 flex flex-wrap items-center gap-x-2 gap-y-1.5 px-1"
      style={{ "--i": 1 } as React.CSSProperties}
    >
      <span className="flow-kicker">so läuft’s:</span>
      <span className="flow-node">
        <b>①</b> {itemCount} items
      </span>
      <span className="flow-arrow">→</span>
      <span
        className="flow-node"
        data-tip="feste reihenfolge, deterministisch — der scheduler zieht das nächste item, sobald ein slot frei wird."
      >
        <b>②</b> warteschlange
      </span>
      <span className="flow-arrow">→</span>
      <span className="flow-node" data-tip="das concurrency-limit: mehr agenten arbeiten nie gleichzeitig.">
        <b>③</b> max. {concurrency} parallel
      </span>
      <span className="flow-arrow">→</span>
      <span className="flow-node">
        <b>④</b> urteil: invest / pass
      </span>
      <span className="flow-guard">⛨ token-budget wacht über den ganzen lauf</span>
    </nav>
  );
});
