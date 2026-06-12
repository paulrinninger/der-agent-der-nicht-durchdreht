import type { ItemStatus, RunState } from "@/src/types";
import { END_REASON_LABEL } from "./labels";

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

  return {
    rows,
    hidden,
    spanMs: span,
    gridlines: timeGridlines(span / 1000),
    nowPct: run.status === "running" ? pct(nowMs) : null,
  };
}

/** shared time-axis ticks: step chosen so the span gets ≤ 8 gridlines */
function timeGridlines(spanSec: number): { pct: number; label: string }[] {
  const step = [1, 2, 5, 10, 15, 30, 60].find((s) => spanSec / s <= 8) ?? 120;
  const gridlines: { pct: number; label: string }[] = [];
  for (let s = step; s < spanSec; s += step) {
    gridlines.push({ pct: (s / spanSec) * 100, label: `t+${s}s` });
  }
  return gridlines;
}

// ---------- token spend over time ----------

export interface TokenPoint {
  ts: number;
  total: number;
}

export interface StopMark {
  ts: number;
  total: number;
  label: string;
  kind: "guard" | "run";
}

export interface TokenSeriesModel {
  points: TokenPoint[];
  limit: number;
  /** y-axis top: max(limit, total) * 1.06 — the dashed limit line stays visible */
  maxY: number;
  t0: number;
  tEnd: number;
  spanMs: number;
  stopMarks: StopMark[];
  gridlines: { pct: number; label: string }[];
}

/** cumulative committed tokens from llm_call traces — pure derivation, O(Σ trace entries) */
export function deriveTokenSeries(run: RunState, nowMs: number, maxPoints = 300): TokenSeriesModel {
  const t0 = run.startedAt;
  const tEnd = Math.max(run.endedAt ?? nowMs, t0 + 1_000);

  // resumed runs carry traces with ts < startedAt — clamp to t0 so the line
  // starts at the carried spend instead of off-canvas
  const commits: { ts: number; tokens: number }[] = [];
  for (const item of run.config.items) {
    const a = run.agents[item.id];
    if (!a) continue;
    for (const t of a.trace) {
      if (t.kind !== "llm_call" || !t.usage) continue;
      commits.push({
        ts: Math.min(Math.max(t.ts, t0), tEnd),
        tokens: t.usage.inputTokens + t.usage.outputTokens,
      });
    }
  }
  commits.sort((x, y) => x.ts - y.ts);

  let total = 0;
  let points: TokenPoint[] = [{ ts: t0, total: 0 }];
  for (const c of commits) {
    total += c.tokens;
    points.push({ ts: c.ts, total });
  }
  points.push({ ts: tEnd, total });

  // marks need the undecimated series for an exact cumulative level
  const totalAt = (ts: number): number => {
    let v = 0;
    for (const p of points) {
      if (p.ts > ts) break;
      v = p.total;
    }
    return v;
  };

  const stopMarks: StopMark[] = [];
  for (const item of run.config.items) {
    const a = run.agents[item.id];
    if (!a || a.status !== "failed" || !a.endReason || a.trace.length === 0) continue;
    const ts = Math.min(Math.max(a.trace[a.trace.length - 1].ts, t0), tEnd);
    stopMarks.push({
      ts,
      total: totalAt(ts),
      label: `${a.itemName} — ${END_REASON_LABEL[a.endReason]}`,
      kind: "guard",
    });
  }
  // aborted agents share the run-level stop — one mark instead of a pile-up
  if (run.status === "stopped" && run.endedAt) {
    const label =
      run.stopReason === "budget"
        ? "Lauf gestoppt — Budget erschöpft"
        : run.stopReason === "kill"
          ? "Lauf gestoppt — Kill-Switch"
          : "Lauf gestoppt — Fehler";
    const ts = Math.min(Math.max(run.endedAt, t0), tEnd);
    stopMarks.push({ ts, total: totalAt(ts), label, kind: "run" });
  }

  if (points.length > maxPoints) {
    const stride = Math.ceil(points.length / maxPoints);
    const last = points.length - 1;
    points = points.filter((_, i) => i % stride === 0 || i === last);
  }

  return {
    points,
    limit: run.budget.limit,
    maxY: Math.max(run.budget.limit, total) * 1.06,
    t0,
    tEnd,
    spanMs: tEnd - t0,
    stopMarks,
    gridlines: timeGridlines((tEnd - t0) / 1000),
  };
}

// ---------- curated incident feed ----------

export type FeedSeverity = "ok" | "warn" | "danger";

export interface FeedItem {
  /** stable react key: `${itemId}:${traceIdx}` or "run:stop" */
  id: string;
  ts: number;
  severity: FeedSeverity;
  /** null = run-level event */
  agentName: string | null;
  text: string;
  detail?: string;
}

/** notable events only (blocked/rescued/stopped) — newest first, uncapped */
export function deriveEvents(run: RunState): FeedItem[] {
  const items: FeedItem[] = [];
  for (const item of run.config.items) {
    const a = run.agents[item.id];
    if (!a) continue;
    a.trace.forEach((t, i) => {
      const id = `${a.itemId}:${i}`;
      switch (t.kind) {
        case "tool_rejected":
          items.push({
            id,
            ts: t.ts,
            severity: "danger",
            agentName: a.itemName,
            text: "Tool-Call geblockt",
            detail: t.detail,
          });
          break;
        case "tool_error":
          // the registry retries internally — this entry means retries ran out
          items.push({
            id,
            ts: t.ts,
            severity: "warn",
            agentName: a.itemName,
            text: "Tool-Fehler — Retries erschöpft",
            detail: t.detail,
          });
          break;
        case "tool_executed":
          if (t.retries && t.retries > 0) {
            items.push({
              id,
              ts: t.ts,
              severity: "ok",
              agentName: a.itemName,
              text: `Tool gerettet — ${t.retries}× Retry mit Backoff`,
            });
          }
          break;
        case "reminder":
          items.push({
            id,
            ts: t.ts,
            severity: "warn",
            agentName: a.itemName,
            text: "Erinnerung — finalize fehlt",
          });
          break;
        case "terminal":
          // aborted agents are covered by the run-level stop row below
          if (a.status === "failed" && a.endReason) {
            items.push({
              id,
              ts: t.ts,
              severity: "warn",
              agentName: a.itemName,
              text: `Gestoppt — ${END_REASON_LABEL[a.endReason]}`,
            });
          }
          break;
      }
    });
  }
  if (run.status === "stopped" && run.endedAt) {
    items.push({
      id: "run:stop",
      ts: run.endedAt,
      severity: run.stopReason === "kill" ? "warn" : "danger",
      agentName: null,
      text:
        run.stopReason === "budget"
          ? "Budget erschöpft — Kill-Switch hat den Lauf gestoppt"
          : run.stopReason === "kill"
            ? "Kill-Switch — Lauf manuell gestoppt"
            : "Lauf mit Fehler gestoppt",
    });
  }
  items.sort((x, y) => y.ts - x.ts);
  return items;
}

// ---------- guardrail counters ----------

export interface GuardStats {
  /** executed + rejected + errored — every call went through validation first */
  checked: number;
  blocked: number;
  toolErrors: number;
  /** Σ retries over tool_executed — transient failures rescued by backoff */
  retries: number;
  /** Ø (last − first trace ts) over terminal agents with ≥2 entries */
  avgDurationMs: number | null;
  budgetPeakOk: boolean;
  kill: "ready" | "fired-kill" | "fired-budget" | "unused";
}

export function deriveGuardStats(run: RunState): GuardStats {
  let checked = 0;
  let blocked = 0;
  let toolErrors = 0;
  let retries = 0;
  let durSum = 0;
  let durN = 0;
  for (const item of run.config.items) {
    const a = run.agents[item.id];
    if (!a) continue;
    for (const t of a.trace) {
      if (t.kind === "tool_executed") {
        checked++;
        retries += t.retries ?? 0;
      } else if (t.kind === "tool_rejected") {
        checked++;
        blocked++;
      } else if (t.kind === "tool_error") {
        checked++;
        toolErrors++;
      }
    }
    const terminal = a.status !== "running" && a.status !== "pending";
    if (terminal && a.trace.length >= 2) {
      durSum += a.trace[a.trace.length - 1].ts - a.trace[0].ts;
      durN++;
    }
  }
  const kill: GuardStats["kill"] =
    run.status === "stopped"
      ? run.stopReason === "budget"
        ? "fired-budget"
        : run.stopReason === "kill"
          ? "fired-kill"
          : "unused"
      : run.status === "running"
        ? "ready"
        : "unused";
  return {
    checked,
    blocked,
    toolErrors,
    retries,
    avgDurationMs: durN > 0 ? durSum / durN : null,
    budgetPeakOk: run.budget.peak <= run.budget.limit,
    kill,
  };
}
