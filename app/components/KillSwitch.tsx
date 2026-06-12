"use client";

import { useHoldToKill } from "./hooks";

/**
 * Hold-to-Kill: 0,7 s halten, bevor der Stopp feuert — ein versehentlicher
 * Klick beendet keinen Batch. Der Ring zeigt ehrlichen Fortschritt.
 */
export function KillSwitch({ onKill, disabled }: { onKill: () => void; disabled?: boolean }) {
  const { progress, handlers } = useHoldToKill(onKill);
  return (
    <button
      {...handlers}
      disabled={disabled}
      className="btn btn-kill hold-btn"
      aria-label="Kill-Switch: 0,7 Sekunden gedrückt halten zum Stoppen"
      data-tip="0,7 Sekunden halten — ein kurzer Klick stoppt absichtlich nichts."
      data-tip-pos="bottom"
      data-tour="kill"
    >
      <span className="hold-ring" style={{ "--p": progress } as React.CSSProperties} aria-hidden />
      ◼ {progress > 0 ? "Halten…" : "Kill-Switch"}
    </button>
  );
}
