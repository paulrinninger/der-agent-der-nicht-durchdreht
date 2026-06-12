"use client";

import { memo, useMemo } from "react";
import type { RunState } from "@/src/types";
import { deriveGuardStats } from "./derive";
import { num } from "./labels";

/**
 * Die Schutzschicht als Live-Zähler (System-Health- und Footer-Chips der
 * Mockups): jede Sicherung mit dem, was sie in diesem Lauf tatsächlich
 * getan hat — keine Deko, nur belegbare Zahlen.
 */
export const GuardrailStrip = memo(function GuardrailStrip({ run }: { run: RunState }) {
  const g = useMemo(() => deriveGuardStats(run), [run]);
  const concOk = run.concurrencyPeak <= run.config.concurrency;

  const killChip =
    g.kill === "ready"
      ? { cls: " guard-ok", text: "Kill-Switch bereit" }
      : g.kill === "fired-kill"
        ? { cls: " guard-warn", text: "Kill-Switch ausgelöst (manuell)" }
        : g.kill === "fired-budget"
          ? { cls: " guard-danger", text: "Kill-Switch ausgelöst (Budget)" }
          : { cls: "", text: "Kill-Switch nicht gebraucht" };

  return (
    <div className="guard-strip" aria-label="Schutzschicht-Status">
      <span
        className={"guard-chip" + (concOk ? " guard-ok" : " guard-danger")}
        data-tip="Höchstwert gleichzeitig aktiver Agenten — liegt nie über dem Limit."
      >
        Concurrency max.{" "}
        <b>
          {run.concurrencyPeak}/{run.config.concurrency}
        </b>{" "}
        {concOk ? "✓" : "✗"}
      </span>
      <span
        className="guard-chip"
        data-tip="Jeder Vorschlag wird vor der Ausführung gegen Tool-Liste und Schema validiert."
      >
        Tool-Calls geprüft <b>{num(g.checked)}</b>
      </span>
      <span
        className={"guard-chip" + (g.blocked > 0 ? " guard-warn" : "")}
        data-tip="Abgelehnte Tool-Calls — erfundene Tools oder ungültige Argumente. Kostet einen Strike, wird nie ausgeführt."
      >
        geblockt <b>{num(g.blocked)}</b>
      </span>
      <span
        className="guard-chip"
        data-tip="Transiente Tool-Fehler, automatisch mit Backoff wiederholt — kein Strike."
      >
        Retries <b>{num(g.retries)}</b>
      </span>
      <span
        className={"guard-chip" + (g.budgetPeakOk ? " guard-ok" : " guard-danger")}
        data-tip="Invariante des Laufs: verbraucht + reserviert lag zu keinem Zeitpunkt über dem Limit."
      >
        Budget-Peak ≤ Limit {g.budgetPeakOk ? "✓" : "✗"}
      </span>
      <span
        className={"guard-chip" + killChip.cls}
        data-tip="Stoppt den ganzen Lauf sauber — manuell per Hold-Button oder automatisch beim Budget-Riss."
      >
        {killChip.text}
      </span>
    </div>
  );
});
