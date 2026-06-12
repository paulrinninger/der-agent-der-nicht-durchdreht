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
  /** gates »weiter« (shows "gleich…") until true — or until waitTimeoutMs unlocks it */
  waitFor?: (run: RunState | null) => boolean;
  waitTimeoutMs?: number;
  skipIf?: (ctx: TourCtx) => boolean;
}

/** satisfied OR moot: true once it happened — or once it can no longer happen */
const toasterDone = (r: RunState | null): boolean =>
  !r ||
  r.status !== "running" ||
  !r.agents["toaster"] || // custom items without the toaster: moot
  ["failed", "aborted"].includes(r.agents["toaster"]?.status ?? "");

export const STEPS: TourStep[] = [
  {
    id: "welcome",
    title: (
      <>
        willkommen im <em className="accent-serif">mission control</em>.
      </>
    ),
    body: (
      <>
        15 startup-ideen von fragwürdiger genialität, 15 ki-agenten, die sie bewerten — und ein
        scheduler, der dafür sorgt, dass keiner durchdreht. die tour dauert zwei minuten und
        startet gleich einen echten lauf. kostet nichts, läuft im demo-modus.
      </>
    ),
  },
  {
    id: "deck",
    target: '[data-tour="deck"]',
    placement: "bottom",
    title: (
      <>
        das concurrency-limit. zum <em className="accent-serif">anfassen</em>.
      </>
    ),
    body: (
      <>
        drei slots, mehr nicht. egal ob 15 items oder 200 — hier arbeiten nie mehr agenten
        gleichzeitig, als der worker-pool erlaubt. kein nacktes promise.all über die liste.
      </>
    ),
  },
  {
    id: "queue",
    target: '[data-tour="queue"]',
    placement: "top",
    title: (
      <>
        die warteschlange. <em className="accent-serif">geduldig</em>.
      </>
    ),
    body: (
      <>
        wer keinen slot hat, wartet hier. in fester reihenfolge, deterministisch. kein drängeln —
        der scheduler zieht das nächste item, sobald ein slot frei wird.
      </>
    ),
  },
  {
    id: "gauge",
    target: '[data-tour="gauge"]',
    placement: "left",
    title: (
      <>
        das budget. der einzige <em className="accent-serif">erwachsene</em> hier.
      </>
    ),
    body: (
      <>
        bevor ein agent auch nur einen api-call macht, muss er tokens reservieren — das ist die
        schraffur im ring. die invariante: verbraucht + reserviert ≤ limit, zu jedem zeitpunkt.
        es startet nie ein call, der das budget reißen könnte. erst nach dem call wird der echte
        verbrauch verbucht.
      </>
    ),
  },
  {
    id: "launch",
    target: '[data-tour="controls"]',
    placement: "bottom",
    title: (
      <>
        genug theorie. <em className="accent-serif">zündung</em>.
      </>
    ),
    body: (
      <>
        der knopf hier startet einen echten lauf — 15 agenten, demo-modus, null euro. einer von
        ihnen wird durchdrehen. das ist absicht. schau hin.
      </>
    ),
    action: { label: "▶ demo-lauf starten ($0)", run: (c) => c.startMockRun() },
    advanceWhen: (r) => r?.status === "running",
    waitTimeoutMs: 10_000,
    skipIf: (c) => c.isRunning,
  },
  {
    id: "bays-live",
    target: '[data-tour="deck"]',
    placement: "bottom",
    title: (
      <>
        sie <em className="accent-serif">docken</em> an.
      </>
    ),
    body: (
      <>
        jeder agent entscheidet selbst, welche tools er ruft: research, draft, critique,
        finalize. was er vorschlägt, wird aber erst validiert — erfundene tools und kaputte
        argumente prallen ab, bevor sie irgendwas anrichten.
      </>
    ),
    waitFor: (r) =>
      !r || r.status !== "running" || Object.values(r.agents).some((a) => a.status === "running"),
    waitTimeoutMs: 4_000,
  },
  {
    id: "ticker",
    target: '[data-tour="ticker"]',
    placement: "right",
    title: (
      <>
        die telemetrie. <em className="accent-serif">alles</em> landet hier.
      </>
    ),
    body: (
      <>
        jeder tool-call, live, über alle agenten. auch die peinlichen — abgelehnte calls flashen
        rot. observability ist bei agenten kein luxus, sondern die einzige art zu wissen, was die
        da eigentlich tun.
      </>
    ),
  },
  {
    id: "toaster",
    // custom items may not include the toaster — fall back to the deck
    target: (c) => (c.run?.agents["toaster"] ? '[data-agent-id="toaster"]' : '[data-tour="deck"]'),
    placement: "left",
    title: (
      <>
        und da ist es <em className="accent-serif">passiert</em>.
      </>
    ),
    body: (
      <>
        der ki-toaster will partout nicht aufhören zu recherchieren. ein klassischer runaway.
        nach exakt 10 steps zieht das step-cap die sicherung: agent gestoppt, als fehler
        markiert. die anderen 14? haben davon nichts mitbekommen. das ist isolation.
      </>
    ),
    waitFor: toasterDone,
    waitTimeoutMs: 8_000,
  },
  {
    id: "kill",
    target: (c) => (c.isRunning ? '[data-tour="kill"]' : '[data-tour="controls"]'),
    placement: "bottom",
    title: (
      <>
        für notfälle: der <em className="accent-serif">kill-switch</em>.
      </>
    ),
    body: (
      <>
        700 millisekunden halten, dann ist schluss — sofort, auch mitten im http-call. kurz
        draufkommen zählt absichtlich nicht: ein batch stirbt hier nicht aus versehen. und
        gestoppt heißt nicht verloren — fortsetzen zahlt fertige agenten nicht doppelt.
      </>
    ),
  },
  {
    id: "finale",
    target: '[data-tour="finale"]',
    placement: "bottom",
    title: (
      <>
        <em className="accent-serif">abrechnung</em>.
      </>
    ),
    body: (
      <>
        invest, pass, ein gescheiterter toaster — und das budget hat gehalten. hat es übrigens
        immer: der peak-marker im ring zeigt den höchsten stand von verbraucht + reserviert. läge
        der je über dem limit, wäre das ein bug. ist er nie.
      </>
    ),
    waitFor: (r) => !r || r.status !== "running",
    waitTimeoutMs: 12_000,
  },
  {
    id: "closing",
    title: (
      <>
        das war die tour. <em className="accent-serif">glaub nichts davon</em>.
      </>
    ),
    body: (
      <>
        prüf es nach: <code className="font-mono text-ink">npm run eval</code> fährt 16
        deterministische assertions gegen genau diese mechanik — runaway gestoppt, budget
        gehalten, isolation bewiesen. exit 0. und wenn du wissen willst, was ein einzelner agent
        gedacht hat: klick auf seine karte — der trace zeigt jeden schritt. eigene ideen? der
        „items“-knopf in der leiste öffnet den editor — name, pitch, fertig. auf wunsch erfindet
        haiku welche dazu. nochmal ansehen? der ✦-knopf oben rechts.
      </>
    ),
  },
];
