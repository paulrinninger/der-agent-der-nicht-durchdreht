"use client";

import { memo } from "react";
import type { RunState } from "@/src/types";
import { num } from "./labels";

type BannerKind = "ok" | "warn" | "danger";

/**
 * Das jüngste nennenswerte Ereignis als ein Banner (Design-Vorgabe):
 * terminale Läufe und — während des Laufs — die zuletzt ausgelöste Sicherung.
 */
function deriveBanner(run: RunState): { kind: BannerKind; text: string } | null {
  if (run.status === "completed") {
    const failed = Object.values(run.agents).filter((a) => a.status === "failed").length;
    return {
      kind: "ok",
      text: failed
        ? `Batch fertig — ${failed} Agent${failed > 1 ? "en" : ""} von einer Sicherung gestoppt, der Rest lief sauber durch. Budget gehalten: ${num(run.budget.used)} / ${num(run.budget.limit)} Tokens.`
        : `Batch sauber durchgelaufen — Budget gehalten: ${num(run.budget.used)} / ${num(run.budget.limit)} Tokens.`,
    };
  }
  if (run.status === "stopped") {
    if (run.stopReason === "budget") {
      return {
        kind: "danger",
        text: `Budget erreicht — der Kill-Switch hat den Lauf sauber gestoppt. Kein Call hat das Limit gerissen (Peak: ${num(run.budget.peak)} / ${num(run.budget.limit)}).`,
      };
    }
    if (run.stopReason === "kill") {
      return {
        kind: "warn",
        text: "Manuell gestoppt — „Fortsetzen“ startet nur die unfertigen Agenten, fertige werden nicht doppelt bezahlt.",
      };
    }
    return { kind: "danger", text: "Lauf mit Fehler gestoppt." };
  }
  // running: jüngste ausgelöste Sicherung zeigen
  const failed = Object.values(run.agents)
    .filter((a) => a.status === "failed" && a.trace.length > 0)
    .sort((a, b) => b.trace[b.trace.length - 1].ts - a.trace[a.trace.length - 1].ts);
  if (failed.length > 0) {
    const a = failed[0];
    const what =
      a.endReason === "step_cap"
        ? "hat das Step-Cap gerissen"
        : a.endReason === "strikes"
          ? "hat 3 ungültige Tool-Calls geliefert"
          : a.endReason === "no_finalize"
            ? "hat kein Urteil abgegeben"
            : "ist ausgefallen";
    return {
      kind: "warn",
      text: `„${a.itemName}“ ${what} — isoliert gestoppt, der Rest des Batches läuft ungestört weiter.`,
    };
  }
  return null;
}

export const Banner = memo(function Banner({ run }: { run: RunState }) {
  const b = deriveBanner(run);
  if (!b) return null;
  return (
    <div className={"banner banner-" + b.kind} key={b.text} data-tour="banner">
      <span className="banner-mark">{b.kind === "ok" ? "●" : b.kind === "warn" ? "▲" : "◼"}</span>
      {b.text}
    </div>
  );
});
