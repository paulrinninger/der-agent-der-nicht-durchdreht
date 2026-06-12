"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RunState } from "@/src/types";
import { STEPS, type TourCtx } from "./steps";

/**
 * Dependency-free spotlight tour. One fixed cutout div whose 9999px box-shadow
 * is the scrim; geometry is JS-lerped per frame so the iris GLIDES between
 * targets, irises shut on centered steps, and opens onto late-mounting targets
 * (the FinaleBand). A single rAF loop subsumes scroll/resize/layout shifts —
 * no listeners. Esc aborts, arrows navigate, popover is a focus-trapped dialog.
 */

const LS_KEY = "agency.tour.v1";
const PAD = 8; // cutout breathing room around the target
const TAU = 110; // lerp time constant (ms): ~95 % converged in ~330 ms

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const reduced = () =>
  typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Tour({
  open,
  onOpenChange,
  run,
  busy,
  onStartMock,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  run: RunState | null;
  busy: boolean;
  onStartMock: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [fired, setFired] = useState(false);

  // fresh state for the rAF loop and go() without re-subscribing
  const ctxRef = useRef<TourCtx>(null!);
  ctxRef.current = { run, busy, isRunning: run?.status === "running", startMockRun: onStartMock };

  const cutoutRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<Box | null>(null);
  const popXY = useRef<{ x: number; y: number } | null>(null);
  const radiusRef = useRef(24);
  const sighted = useRef(false);
  const lastT = useRef(0);
  const raf = useRef(0);
  const step = STEPS[idx];

  const close = useCallback(
    (mark: "done" | "skipped") => {
      try {
        localStorage.setItem(LS_KEY, mark);
      } catch {}
      onOpenChange(false);
      setIdx(0);
      setFired(false);
      setWaiting(false);
      boxRef.current = null;
      popXY.current = null;
    },
    [onOpenChange],
  );

  const go = useCallback(
    (dir: 1 | -1) => {
      let i = idx + dir;
      while (STEPS[i]?.skipIf?.(ctxRef.current)) i += dir;
      if (i >= STEPS.length) return close("done");
      if (i < 0) return;
      sighted.current = false;
      setFired(false);
      setIdx(i);
    },
    [idx, close],
  );

  // ---- auto-offer once on first visit, only when the dashboard is empty ----
  const offered = useRef(false);
  useEffect(() => {
    if (offered.current) return;
    const t = setTimeout(() => {
      try {
        if (localStorage.getItem(LS_KEY) || ctxRef.current.run) return;
        offered.current = true;
        localStorage.setItem(LS_KEY, "offered"); // a mid-tour reload won't re-trigger
        onOpenChange(true);
      } catch {}
    }, 900);
    return () => clearTimeout(t);
  }, [onOpenChange]);

  // ---- live predicates: re-evaluated on every rAF-coalesced run flush ----
  useEffect(() => {
    if (!open) return;
    if (step.advanceWhen?.(run)) {
      go(1);
      return;
    }
    if (waiting && step.waitFor?.(run)) setWaiting(false);
  }, [run, open, step, waiting, go]);

  // wait-gate arming + timeout fallback, once per step entry
  useEffect(() => {
    if (!open || !step.waitFor || step.waitFor(ctxRef.current.run)) {
      setWaiting(false);
      return;
    }
    setWaiting(true);
    const t = setTimeout(() => setWaiting(false), step.waitTimeoutMs ?? 8000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idx]);

  // ---- rect tracking: ONE rAF loop, reads then writes, no listeners ----
  useEffect(() => {
    if (!open) return;
    const tick = (now: number) => {
      raf.current = requestAnimationFrame(tick);
      const dt = Math.min(64, now - (lastT.current || now));
      lastT.current = now;

      const sel = typeof step.target === "function" ? step.target(ctxRef.current) : step.target;
      const el = sel ? document.querySelector<HTMLElement>(sel) : null;
      const vw = innerWidth;
      const vh = innerHeight;

      if (el && !sighted.current) {
        // (re)appearing target — compute its radius once, center it once
        sighted.current = true;
        radiusRef.current = Math.min(
          (parseFloat(getComputedStyle(el).borderRadius) || 20) + PAD / 2,
          28,
        );
        el.scrollIntoView({ block: "center", behavior: reduced() ? "auto" : "smooth" });
      }

      let goal: Box;
      if (el) {
        const r = el.getBoundingClientRect();
        goal = {
          x: r.left - PAD,
          y: r.top - PAD,
          w: r.width + 2 * PAD,
          h: r.height + 2 * PAD,
          r: radiusRef.current,
        };
      } else {
        // no target: iris shut at center, scrim stays up
        goal = { x: vw / 2, y: vh * 0.42, w: 0, h: 0, r: 24 };
      }

      const k = reduced() ? 1 : 1 - Math.exp(-dt / TAU);
      const b = boxRef.current ?? goal;
      boxRef.current = {
        x: lerp(b.x, goal.x, k),
        y: lerp(b.y, goal.y, k),
        w: lerp(b.w, goal.w, k),
        h: lerp(b.h, goal.h, k),
        r: lerp(b.r, goal.r, k),
      };

      const c = cutoutRef.current;
      if (c) {
        c.style.left = `${boxRef.current.x}px`;
        c.style.top = `${boxRef.current.y}px`;
        c.style.width = `${boxRef.current.w}px`;
        c.style.height = `${boxRef.current.h}px`;
        c.style.borderRadius = `${boxRef.current.r}px`;
      }
      if (popRef.current) {
        placePopover(popRef.current, boxRef.current, step.placement, !!el, k, popXY, vw, vh);
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf.current);
      lastT.current = 0;
    };
  }, [open, idx, step]);

  // ---- keyboard + focus ----
  useEffect(() => {
    if (!open) return;
    popRef.current?.focus({ preventScroll: true });
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") close("done");
      else if (e.key === "ArrowRight" && !waiting) go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, idx, waiting, go, close]);

  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !popRef.current) return;
    const focusables = [...popRef.current.querySelectorAll<HTMLButtonElement>("button")].filter(
      (b) => !b.disabled,
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="tour-shield" onPointerDown={(e) => e.preventDefault()} />
      <div ref={cutoutRef} className="tour-cutout" aria-hidden />
      <div
        ref={popRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        tabIndex={-1}
        className="tour-pop"
        onKeyDown={trapTab}
      >
        <div key={idx} className="tour-step-in">
          <p className="tour-kicker">
            Schritt {idx + 1}/{STEPS.length}
          </p>
          <h3 id="tour-title" style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.015em", marginTop: 4 }}>
            {step.title}
          </h3>
          <div
            aria-live="polite"
            style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.55, color: "var(--muted)" }}
          >
            {step.body}
          </div>
          {step.action &&
            (fired ? (
              <p className="tour-wait" style={{ marginTop: 14 }}>
                <span className="pulse-dot" /> Startet…
              </p>
            ) : (
              <button
                className="btn btn-primary"
                style={{ marginTop: 14, width: "100%" }}
                disabled={busy}
                onClick={() => {
                  step.action!.run(ctxRef.current);
                  setFired(true);
                }}
              >
                {step.action.label}
              </button>
            ))}
          {/* dots über den buttons: 11 dots + drei deutsche labels passen nie
              nebeneinander in die 22rem-box — zweizeilig statt überlauf */}
          <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
            <div className="tour-dots" aria-hidden>
              {STEPS.map((s, i) => (
                <span key={s.id} className={`tour-dot ${i === idx ? "tour-dot-active" : ""}`} />
              ))}
            </div>
          </div>
          <div
            style={{
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => close("skipped")}>
              Überspringen
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
              {idx > 0 && (
                <button className="btn" style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => go(-1)}>
                  Zurück
                </button>
              )}
              <button
                className="btn"
                style={{ fontSize: 12, padding: "5px 12px" }}
                disabled={waiting}
                onClick={() => go(1)}
              >
                {waiting ? "Gleich…" : idx === STEPS.length - 1 ? "Fertig" : "Weiter"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** prefer step.placement if it fits, else bottom→top→right→left, clamp 16px */
function placePopover(
  pop: HTMLDivElement,
  b: Box,
  pref: string | undefined,
  hasTarget: boolean,
  k: number,
  popXY: React.MutableRefObject<{ x: number; y: number } | null>,
  vw: number,
  vh: number,
) {
  if (vw < 640) {
    pop.style.transform = ""; // CSS bottom-sheet takes over
    return;
  }
  const m = 16;
  const gap = 14;
  const pw = pop.offsetWidth;
  const ph = pop.offsetHeight;
  const cx = (x: number) => Math.min(Math.max(x, m), vw - pw - m);
  const cy = (y: number) => Math.min(Math.max(y, m), vh - ph - m);
  let gx: number;
  let gy: number;
  if (!hasTarget) {
    gx = (vw - pw) / 2;
    gy = (vh - ph) / 2;
  } else {
    const fit = {
      bottom: b.y + b.h + gap + ph <= vh - m,
      top: b.y - gap - ph >= m,
      right: b.x + b.w + gap + pw <= vw - m,
      left: b.x - gap - pw >= m,
    };
    const side =
      pref && fit[pref as keyof typeof fit]
        ? pref
        : fit.bottom
          ? "bottom"
          : fit.top
            ? "top"
            : fit.right
              ? "right"
              : fit.left
                ? "left"
                : "pin";
    if (side === "bottom") {
      gx = cx(b.x);
      gy = b.y + b.h + gap;
    } else if (side === "top") {
      gx = cx(b.x);
      gy = b.y - gap - ph;
    } else if (side === "right") {
      gx = b.x + b.w + gap;
      gy = cy(b.y);
    } else if (side === "left") {
      gx = b.x - gap - pw;
      gy = cy(b.y);
    } else {
      gx = (vw - pw) / 2;
      gy = vh - ph - m; // huge target: pin bottom-center
    }
  }
  const p = popXY.current ?? { x: gx, y: gy };
  popXY.current = { x: lerp(p.x, gx, k), y: lerp(p.y, gy, k) };
  pop.style.transform = `translate3d(${popXY.current.x}px, ${popXY.current.y}px, 0)`;
}
