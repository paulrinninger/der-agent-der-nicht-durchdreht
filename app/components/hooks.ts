"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Client-side hooks. They consume the rAF-coalesced RunState from page.tsx —
 * never the core directly.
 */

// ---------- wall clock for live views ----------

/** ticks every 500ms while active (timeline now-cursor), static otherwise */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [active]);
  return now;
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
