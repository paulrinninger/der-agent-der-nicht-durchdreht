import type { ItemStatus, RunState } from "@/src/types";

/**
 * Pure client-side derivations from existing run state — the core stays
 * untouched, everything here reads what the orchestrator already emits.
 */

export type Verdict = "invest" | "pass" | null;

/** finalize output is `💸 INVEST — …` or `🙅 PASS — …` */
export function parseVerdict(result?: string): Verdict {
  if (!result) return null;
  if (result.startsWith("\u{1F4B8}")) return "invest";
  if (result.startsWith("\u{1F645}")) return "pass";
  return null;
}

/** telemetry timestamp relative to run start: `t+04,2s` */
export function formatT(ts: number, startedAt: number): string {
  const s = Math.max(0, (ts - startedAt) / 1000);
  return `t+${s.toFixed(1).replace(".", ",")}s`;
}

export function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
}

// ---------- run timeline (gantt) ----------

export interface TimelineTick {
  pct: number;
  kind: "executed" | "rejected" | "error";
}

export interface TimelineRow {
  itemId: string;
  name: string;
  status: ItemStatus;
  startPct: number;
  endPct: number;
  ticks: TimelineTick[];
  tooltip: string;
}

export interface TimelineModel {
  rows: TimelineRow[];
  hidden: number;
  spanMs: number;
  gridlines: { pct: number; label: string }[];
  nowPct: number | null;
}

const TICK_KIND: Partial<Record<string, TimelineTick["kind"]>> = {
  tool_executed: "executed",
  tool_rejected: "rejected",
  tool_error: "error",
};

/** pure derivation from existing traces — no core changes, O(Σ trace entries) */
export function deriveTimeline(run: RunState, nowMs: number, cap = 60): TimelineModel {
  const t0 = run.startedAt;
  const tEnd = Math.max(run.endedAt ?? nowMs, t0 + 1_000);
  const span = tEnd - t0;
  const pct = (t: number) => Math.min(100, Math.max(0, ((t - t0) / span) * 100));

  const rows: TimelineRow[] = [];
  let hidden = 0;
  for (const item of run.config.items) {
    const a = run.agents[item.id];
    if (!a || a.trace.length === 0) continue;
    if (rows.length >= cap) {
      hidden++;
      continue;
    }
    const terminal = a.status !== "running" && a.status !== "pending";
    const start = a.trace[0].ts;
    const end = terminal ? a.trace[a.trace.length - 1].ts : nowMs;
    const ticks: TimelineTick[] = [];
    let rejected = 0;
    for (const t of a.trace) {
      const kind = TICK_KIND[t.kind];
      if (!kind) continue;
      if (kind !== "executed") rejected++;
      ticks.push({ pct: pct(t.ts), kind });
    }
    rows.push({
      itemId: a.itemId,
      name: a.itemName,
      status: a.status,
      startPct: pct(start),
      endPct: pct(end),
      ticks,
      tooltip: `${a.trace.length} Einträge · ${rejected} abgelehnt/Fehler · ${((end - start) / 1000).toFixed(1).replace(".", ",")}s`,
    });
  }

  const spanSec = span / 1000;
  const step = [1, 2, 5, 10, 15, 30, 60].find((s) => spanSec / s <= 8) ?? 120;
  const gridlines: { pct: number; label: string }[] = [];
  for (let s = step; s < spanSec; s += step) {
    gridlines.push({ pct: (s / spanSec) * 100, label: `t+${s}s` });
  }

  return {
    rows,
    hidden,
    spanMs: span,
    gridlines,
    nowPct: run.status === "running" ? pct(nowMs) : null,
  };
}
