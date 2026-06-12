import type { ReactNode } from "react";
import type { RunState } from "@/src/types";

export interface TourCtx {
  run: RunState | null;
  isRunning: boolean;
  busy: boolean;
  startMockRun: () => void;
}

export interface TourStep {
  id: string;
  /** CSS selector, or a fn for state-dependent targets. undefined = centered step */
  target?: string | ((ctx: TourCtx) => string);
  placement?: "top" | "bottom" | "left" | "right";
  title: ReactNode;
  body: ReactNode;
  action?: { label: string; run: (ctx: TourCtx) => void };
  /** auto-advance the instant this flips true (re-evaluated on every run flush) */
  advanceWhen?: (run: RunState | null) => boolean;
  /** gates »Weiter« (shows "Gleich…") until true — or until waitTimeoutMs unlocks it */
  waitFor?: (run: RunState | null) => boolean;
  waitTimeoutMs?: number;
  skipIf?: (ctx: TourCtx) => boolean;
}

/** satisfied OR moot: true once it happened — or once it can no longer happen */
const toasterDone = (r: RunState | null): boolean =>
  !r ||
  r.status !== "running" ||
  !r.agents["toaster"] ||
  ["failed", "aborted"].includes(r.agents["toaster"]?.status ?? "");

export const STEPS: TourStep[] = [
  {
    id: "welcome",
    title: <>Willkommen im Dashboard.</>,
    body: (
      <>
        15 Startup-Ideen von fragwürdiger Genialität, 15 KI-Agenten, die sie bewerten — und ein
        Scheduler, der dafür sorgt, dass keiner durchdreht. Die Tour dauert zwei Minuten und
        startet gleich einen echten Lauf. Kostet nichts, läuft im Demo-Modus.
      </>
    ),
  },
  {
    id: "tabs",
    target: '[data-tour="tabs"]',
    placement: "bottom",
    title: <>Drei Läufe, eine Pointe.</>,
    body: (
      <>
        Kontrolliert läuft sauber durch. Bei „Agenten drehen durch“ benehmen sich sechs Agenten
        absichtlich daneben. Und Budget-Crunch zeigt, was der Kill-Switch tut, wo der naive Bau
        einfach weiterbrennen würde.
      </>
    ),
  },
  {
    id: "stats",
    target: '[data-tour="stats"]',
    placement: "bottom",
    title: <>Das Concurrency-Limit, live.</>,
    body: (
      <>
        Nie mehr als drei Agenten gleichzeitig — egal ob 15 Items oder 200. Wer keinen Slot hat,
        steht in der Warteschlange. Kein nacktes promise.all über die Liste.
      </>
    ),
  },
  {
    id: "budget",
    target: '[data-tour="budget"]',
    placement: "bottom",
    title: <>Das Budget. Der einzige Erwachsene hier.</>,
    body: (
      <>
        Bevor ein Agent auch nur einen KI-Call macht, muss er Tokens reservieren — das ist der
        schraffierte Teil des Balkens. Die Invariante: verbraucht + reserviert ≤ Limit, zu jedem
        Zeitpunkt. Es startet nie ein Call, der das Budget reißen könnte.
      </>
    ),
  },
  {
    id: "launch",
    target: '[data-tour="controls"]',
    placement: "bottom",
    title: <>Genug Theorie. Zündung.</>,
    body: (
      <>
        Der Knopf hier startet einen echten Lauf — 15 Agenten, Demo-Modus, null Euro. Einer von
        ihnen wird durchdrehen. Das ist Absicht. Schau hin.
      </>
    ),
    action: { label: "▶ Demo-Lauf starten ($0)", run: (c) => c.startMockRun() },
    advanceWhen: (r) => r?.status === "running",
    waitTimeoutMs: 10_000,
    skipIf: (c) => c.isRunning,
  },
  {
    id: "grid",
    target: '[data-tour="grid"]',
    placement: "top",
    title: <>Die Agenten arbeiten.</>,
    body: (
      <>
        Jeder Agent entscheidet selbst, welche Tools er ruft: Recherche, Entwurf, Kritik,
        Finalisieren. Was er vorschlägt, wird aber erst validiert — erfundene Tools und kaputte
        Argumente prallen ab, bevor sie irgendwas anrichten.
      </>
    ),
    waitFor: (r) =>
      !r || r.status !== "running" || Object.values(r.agents).some((a) => a.status === "running"),
    waitTimeoutMs: 4_000,
  },
  {
    id: "toaster",
    target: (c) => (c.run?.agents["toaster"] ? '[data-agent-id="toaster"]' : '[data-tour="grid"]'),
    placement: "left",
    title: <>Und da ist es passiert.</>,
    body: (
      <>
        Der KI-Toaster will partout nicht aufhören zu recherchieren — ein klassischer Runaway.
        Nach exakt 10 Steps zieht das Step-Cap die Sicherung: Agent gestoppt, als Fehler markiert.
        Die anderen 14? Haben davon nichts mitbekommen. Das ist Isolation.
      </>
    ),
    waitFor: toasterDone,
    waitTimeoutMs: 8_000,
  },
  {
    id: "kill",
    target: (c) => (c.isRunning ? '[data-tour="kill"]' : '[data-tour="controls"]'),
    placement: "bottom",
    title: <>Für Notfälle: der Kill-Switch.</>,
    body: (
      <>
        0,7 Sekunden halten, dann ist Schluss — sofort, auch mitten im HTTP-Call. Kurz
        draufkommen zählt absichtlich nicht: Ein Batch stirbt hier nicht aus Versehen. Und
        gestoppt heißt nicht verloren — Fortsetzen zahlt fertige Agenten nicht doppelt.
      </>
    ),
  },
  {
    id: "timeline",
    target: '[data-tour="timeline"]',
    placement: "top",
    title: <>Daten und Fakten.</>,
    body: (
      <>
        Die Timeline zeigt den ganzen Lauf: ein Balken pro Agent, eine Kerbe pro Tool-Call, rote
        Kerben für abgelehnte Calls. Wer wann lief, wie lange, und wo eine Sicherung gezogen hat —
        alles aus den Traces abgeleitet.
      </>
    ),
    waitFor: (r) => !r || r.status !== "running",
    waitTimeoutMs: 12_000,
  },
  {
    id: "banner",
    target: '[data-tour="banner"]',
    placement: "bottom",
    title: <>Die Abrechnung.</>,
    body: (
      <>
        Invest, Pass, ein gescheiterter Toaster — und das Budget hat gehalten. Hat es übrigens
        immer: Der Peak-Marker im Budget-Balken zeigt den höchsten Stand von verbraucht +
        reserviert. Läge der je über dem Limit, wäre das ein Bug. Ist er nie.
      </>
    ),
    waitFor: (r) => !r || r.status !== "running",
    waitTimeoutMs: 4_000,
  },
  {
    id: "closing",
    title: <>Das war die Tour. Glaub nichts davon.</>,
    body: (
      <>
        Prüf es nach: <span className="mono">npm run eval</span> fährt 16 deterministische
        Assertions gegen genau diese Mechanik — Runaway gestoppt, Budget gehalten, Isolation
        bewiesen. Exit 0. Klick auf eine Karte zeigt den vollständigen Agent-Trace. Eigene Ideen?
        Der „Items“-Knopf öffnet den Editor — auf Wunsch erfindet Haiku welche dazu. Nochmal
        ansehen? „✦ Tour“ oben rechts.
      </>
    ),
  },
];
