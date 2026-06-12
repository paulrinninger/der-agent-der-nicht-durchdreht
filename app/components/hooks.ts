"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { RunState, TraceKind } from "@/src/types";

/**
 * Client-side derivation hooks. All of them consume the (rAF-coalesced)
 * RunState — they never talk to the core. Traces and budget are cumulative,
 * so coalesced/dropped intermediate SSE events lose nothing.
 */

// ---------- worker-slot assignment ----------

/**
 * Maps running agents to scheduler bays: lowest free slot, freed on terminal.
 * Deterministic on reconnect (assignment in config.items order), idempotent
 * under React StrictMode double-render.
 */
export function useSlotAssignments(run: RunState | null): (string | null)[] {
  const assigned = useRef(new Map<string, number>());
  const runId = useRef<string | null>(null);

  return useMemo(() => {
    if (!run) {
      assigned.current.clear();
      runId.current = null;
      return [];
    }
    if (runId.current !== run.id) {
      assigned.current.clear();
      runId.current = run.id;
    }
    const n = run.config.concurrency;
    const map = assigned.current;
    const running = new Set(
      run.config.items.filter((i) => run.agents[i.id]?.status === "running").map((i) => i.id),
    );
    for (const id of [...map.keys()]) if (!running.has(id)) map.delete(id);
    for (const item of run.config.items) {
      if (!running.has(item.id) || map.has(item.id)) continue;
      const taken = new Set(map.values());
      let s = 0;
      while (taken.has(s)) s++;
      if (s < n) map.set(item.id, s);
    }
    const slots: (string | null)[] = Array.from({ length: n }, () => null);
    for (const [id, s] of map) if (s < n) slots[s] = id;
    return slots;
  }, [run]);
}

// ---------- live telemetry feed ----------

export interface TickerEntry {
  id: number;
  ts: number;
  agentId: string;
  agentName: string;
  kind: TraceKind;
  detail: string;
  /** backfilled on (re)connect — rendered without enter animation */
  backfill?: boolean;
}

export function useTicker(run: RunState | null, cap = 50): TickerEntry[] {
  const [feed, setFeed] = useState<TickerEntry[]>([]);
  const seen = useRef(new Map<string, number>()); // itemId -> consumed trace.length
  const runId = useRef<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!run) return;
    if (runId.current !== run.id) {
      runId.current = run.id;
      seen.current.clear();
      const all: TickerEntry[] = [];
      for (const a of Object.values(run.agents)) {
        a.trace.forEach((t) =>
          all.push({
            id: seq.current++,
            ts: t.ts,
            agentId: a.itemId,
            agentName: a.itemName,
            kind: t.kind,
            detail: t.detail,
            backfill: true,
          }),
        );
        seen.current.set(a.itemId, a.trace.length);
      }
      all.sort((x, y) => y.ts - x.ts);
      setFeed(all.slice(0, 20));
      return;
    }
    const fresh: TickerEntry[] = [];
    for (const a of Object.values(run.agents)) {
      const have = seen.current.get(a.itemId) ?? 0;
      for (let i = have; i < a.trace.length; i++) {
        const t = a.trace[i];
        fresh.push({
          id: seq.current++,
          ts: t.ts,
          agentId: a.itemId,
          agentName: a.itemName,
          kind: t.kind,
          detail: t.detail,
        });
      }
      seen.current.set(a.itemId, a.trace.length);
    }
    if (fresh.length) {
      fresh.sort((x, y) => x.ts - y.ts);
      setFeed((prev) => [...fresh.reverse(), ...prev].slice(0, cap));
    }
  }, [run, cap]);

  return feed;
}

// ---------- odometer ----------

/**
 * rAF-eased display value for premium rolling numerals (tabular-nums does the
 * rest — digit strips stutter under 20+ retargets/s, an eased value doesn't).
 * Snaps under prefers-reduced-motion.
 */
export function useOdometer(target: number, duration = 600): number {
  const [display, setDisplay] = useState(target);
  const current = useRef(target);
  const raf = useRef(0);
  const reduced = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (reduced.current) {
      current.current = target;
      setDisplay(target);
      return;
    }
    cancelAnimationFrame(raf.current);
    const from = current.current;
    if (from === target) return;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      current.current = from + (target - from) * eased;
      setDisplay(current.current);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  return display;
}

// ---------- burn series (sparkline) ----------

export interface BurnPoint {
  t: number;
  used: number;
}

export function useBurnSeries(run: RunState | null, max = 60): BurnPoint[] {
  const pts = useRef<BurnPoint[]>([]);
  const runId = useRef<string | null>(null);
  const [, bump] = useReducer((c: number) => c + 1, 0);

  useEffect(() => {
    if (!run) return;
    if (runId.current !== run.id) {
      runId.current = run.id;
      pts.current = [{ t: run.startedAt, used: 0 }];
    }
    const last = pts.current[pts.current.length - 1];
    if (last.used !== run.budget.used) {
      pts.current.push({ t: Date.now(), used: run.budget.used });
      if (pts.current.length > max * 2) {
        const mid = Math.floor(pts.current.length / 2);
        pts.current = [
          ...pts.current.slice(0, mid).filter((_, i) => i % 2 === 0),
          ...pts.current.slice(mid),
        ];
      }
      bump();
    }
  }, [run, max]);

  return pts.current;
}

// ---------- hold-to-kill ----------

/**
 * Press & hold (700ms) before the kill fires — accidental clicks can't stop a
 * batch. The ring is driven per-frame via an inline --p custom property, so it
 * works under prefers-reduced-motion too (functional feedback, not decor).
 */
export function useHoldToKill(onFire: () => void, holdMs = 700) {
  const [progress, setProgress] = useState(0);
  const raf = useRef(0);

  const cancel = useCallback(() => {
    cancelAnimationFrame(raf.current);
    setProgress(0);
  }, []);

  const begin = useCallback(() => {
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / holdMs);
      setProgress(p);
      if (p >= 1) {
        setProgress(0);
        onFire();
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(tick);
  }, [onFire, holdMs]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return {
    progress,
    handlers: {
      onPointerDown: begin,
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
      onKeyDown: (e: React.KeyboardEvent) => {
        if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
          e.preventDefault();
          begin();
        }
      },
      onKeyUp: cancel,
    },
  };
}
