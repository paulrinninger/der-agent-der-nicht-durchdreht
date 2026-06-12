"use client";

import { useHoldToKill } from "./hooks";

/**
 * Hold-to-kill: 700ms hold before the kill fires — a batch can't be stopped
 * by an accidental click. The conic ring is honest progress (linear, rAF).
 */
export function KillSwitch({ onKill, disabled }: { onKill: () => void; disabled?: boolean }) {
  const { progress, handlers } = useHoldToKill(onKill);
  return (
    <button
      {...handlers}
      disabled={disabled}
      className="btn btn-destructive hold-btn"
      aria-label="Kill-Switch: 0,7 Sekunden gedrückt halten zum Stoppen"
      data-tour="kill"
    >
      <span className="hold-ring" style={{ "--p": progress } as React.CSSProperties} aria-hidden />
      ■ {progress > 0 ? "halten…" : "halten zum stoppen"}
    </button>
  );
}
