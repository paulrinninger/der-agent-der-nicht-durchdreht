# der agent, der nicht durchdreht.

Take-Home KI-Engineering: ~15 Quatsch-Startups laufen als Batch durch je einen kleinen
LLM-Agenten mit Tools (`research → draft → critique → finalize`). Der Agent entscheidet
selbst über Reihenfolge und Ende — der Orchestrator sorgt dafür, dass dabei nichts
durchdreht: Concurrency-Limit, Tool-Call-Validierung, Step-/Token-Caps pro Agent und
ein globales Token-Budget mit Kill-Switch, im Flug eingehalten.

## Schnellstart

```bash
npm install
npm run build && npm start     # → http://localhost:3000
```

**Ohne API-Key läuft alles im Mock-Modus** — $0, deterministisch, drei Items
demonstrieren live die Schutzmechanismen (ein Runaway, ein erfundenes Tool, ein flaky
Tool). Für echte Läufe mit `claude-haiku-4-5`:

```bash
cp .env.example .env           # ANTHROPIC_API_KEY eintragen, Server neu starten
```

Ein voller Echt-Lauf kostet ca. 0,10–0,30 $ (Haiku: $1/$5 pro MTok, Kosten live im UI).

> `npm run dev` funktioniert auch (der Orchestrator hängt HMR-sicher an
> globalThis-Singletons), aber ein File-Save killt den Dev-Server-Prozess und damit den
> laufenden Batch — für Batches deshalb `npm start`. Falls doch: der Batch lässt sich
> per **Fortsetzen** aus dem Checkpoint wieder aufnehmen.

## Geführte Tour

Beim ersten Besuch bietet sich eine **interaktive Tour** an (jederzeit neu über
„✦ Tour" oben rechts): 11 Schritte, die nicht nur erklären, sondern **mitten in der
Tour einen echten Demo-Lauf starten** und live kommentieren — wie die Agenten
loslegen, wie der KI-Toaster durchdreht und vom Step-Cap gestoppt wird, und warum das
Budget am Ende gehalten hat. Spotlight-Engine ohne Dependencies (eine JS-gelerpte Iris,
die zwischen den Elementen gleitet), Esc bricht ab, ←/→ navigieren.

## Dashboard

Helles Editorial-Design (Hell/Dunkel-Toggle, persistiert): Szenario-Tabs spiegeln die
drei Läufe der Aufgaben-Seite — **Kontrollierter Lauf**, **Agenten drehen durch**,
**Budget-Crunch**. Der **Stats-Strip** zeigt Aktiv/Limit, Warteschlange, Fertig,
Gestoppt, Abgebrochen, Kosten und das globale Token-Budget als Balken — die
schraffierten Reservierungen sind die reserve→commit-Mechanik in Echtzeit, der
Peak-Marker beweist die Invariante. Ein **Banner** kommentiert das jüngste Ereignis
(ausgelöste Sicherung, Budget-Stopp, saubere Bilanz), jede Agent-Karte trägt
Status-Pill, Step-Minibar und den letzten Tool-Call; Klick öffnet den **Agent-Trace**.
Dazu **Hold-to-Kill** (700 ms halten — kein versehentlicher Stopp) und die
**Lauf-Timeline** (Gantt über alle Agenten). Alles Client-seitig aus dem Run-State
abgeleitet — null Änderung am Kern.

## Eigene Items, KI-Generator, Demo-Läufe, Timeline

- **Item-Editor** („items"-Knopf): eigene Startup-Ideen eingeben (Name + Pitch), per
  💥 ein Item absichtlich durchdrehen lassen (nur Mock), alles in localStorage
  persistiert. Der Server validiert (zod), slugified umlaut-sicher und hält bei bis zu
  200 Items.
- **✨ KI-Generator**: Haiku erfindet auf Knopfdruck neue Quatsch-Startups (optional zu
  einem Thema) — via Structured Outputs, Kosten werden angezeigt (~$0,002 für 5 Ideen).
  Ohne API-Key fällt er ehrlich gelabelt auf einen Offline-Kombinator zurück.
- **Drei Demo-Läufe** wie auf der Aufgaben-Seite: *kontrollierter lauf [ok]* ·
  *chaos-crew [gestoppt]* (6 absichtlich kaputte Agenten — 4 verschiedene Sicherungen
  feuern, einer korrigiert sich selbst) · *budget-crunch [budget]* (10k-Budget, der
  Kill-Switch greift live).
- **Lauf-Timeline**: Live-Gantt über alle Agenten — Lebensdauer-Balken (farbcodiert nach
  Ausgang), Notches pro Tool-Call (rot = abgelehnt), Now-Cursor, Zeitachse. Komplett aus
  den vorhandenen Traces abgeleitet.

## Eval-Modus — die Pflicht-Kriterien als Beweis, ohne UI und ohne Key

```bash
npm run eval     # 16 deterministische Assertions, Exit 0/1
npm run smoke    # ein voller Mock-Batch als Konsolen-Tabelle
```

Der Eval importiert den Orchestrator direkt (kein Next.js-Server) und beweist u. a.:
Concurrency-High-Water-Mark `=== 3` bei 50 Items · Step-Cap stoppt den Runaway bei exakt
`maxSteps`, Geschwister laufen weiter · erfundenes Tool wird abgelehnt und der Agent
korrigiert sich über das error-tool_result selbst · kaputte Args (falsche Keys, roher
String, `null`) ⇒ 3 Strikes ⇒ failed · crashender LLM-Call bleibt isoliert · Budget-Peak
`used + reserved ≤ limit` auch unter 4-facher Parallelität · Retry/Backoff rettet ein
flaky Tool · Resume zahlt fertige Agenten nicht doppelt.

## Die wichtigste Entscheidung

Concurrency, Isolation und Budget greifen über drei Mechanismen ineinander: Ein
handgerollter Worker-Pool (kein `Promise.all` über die Item-Liste) hält das
Parallel-Limit bei 15 wie bei 200 Items, und jeder Agent läuft komplett in
try/catch mit eigener State-Machine — ein durchdrehender oder crashender Agent gibt nur
seinen Worker-Slot frei. Das globale Budget wird nicht geprüft, sondern **reserviert**:
Vor jedem LLM-Call reserviert der Agent synchron eine obere Schranke
(Input-Schätzung + exaktes `max_tokens`) und committet danach den Ist-Verbrauch — die
Invariante `used + reserved ≤ limit` gilt dadurch zu jedem Zeitpunkt, es startet nie ein
Call, der das Budget reißen könnte (ein nacktes `remaining > 0` hätte ein Race: N
parallele Agenten passieren den Check gleichzeitig), und die erste fehlgeschlagene
Reservierung flippt den Kill-Switch für den ganzen Run. Liefert eine Stufe Müll —
erfundenes Tool, kaputte Args, invalides JSON —, wird der Call validiert statt blind
ausgeführt: Der Fehler geht als error-tool_result zur Selbstkorrektur ans Modell zurück,
nach drei Strikes ist der Agent failed, und der Batch läuft ungerührt weiter.

## Pflicht-Kriterien → Implementierung → Beweis

| Kriterium | Implementierung | Beweis |
|---|---|---|
| Concurrency unter Kontrolle | [src/orchestrator/scheduler.ts](src/orchestrator/scheduler.ts) — Worker-Pool, N Runner ziehen von einem Cursor | Eval: HWM `=== 3` bei 50 Items, alle 50 fertig |
| Tool-Calls validieren | [src/tools/registry.ts](src/tools/registry.ts) — zod, validate-then-execute, Strikes | Eval: invented-tool (Selbstkorrektur), broken-args (3 Strikes) |
| Loop-Kontrolle + Isolation | [src/agent/agent-loop.ts](src/agent/agent-loop.ts) — Step-Cap, Agent-Token-Cap, finalize-Regel, try/catch | Eval: Runaway stirbt bei `maxSteps`, Crasher isoliert, Geschwister fertig |
| Globales Budget + Kill-Switch | [src/orchestrator/budget.ts](src/orchestrator/budget.ts) — reserve→commit | Eval: `peak ≤ limit` seriell und unter Concurrency; UI zeigt used/reserved/Kosten live |

Terminierungszustände pro Agent: `completed/finalized` · `failed/step_cap · token_cap ·
strikes · no_finalize · error` · `aborted/killed · global_budget`. Beendet das Modell
seinen Turn ohne `finalize`, gibt es genau eine Erinnerung — danach `failed/no_finalize`
(bare `end_turn` zählt bewusst nicht als Erfolg). Budget-Stopp ist graceful (laufende
Calls committen sauber an der Step-Grenze), der manuelle Kill-Switch feuert zusätzlich
den `AbortController` in die laufenden HTTP-Calls.

## Stretch-Goals (alle vier)

- **Eval-/Test-Modus** — `npm run eval`, s. o. Bewusst *vor* dem Dashboard gebaut: bewertet wird Loop-Kontrolle, nicht Pixel.
- **Agent-Trace** — jeder Tool-Call mit Args, Validierungsergebnis, Tokens und Retries; im UI per Klick auf eine Agent-Karte, persistiert im Checkpoint.
- **Retry mit Backoff** — exponentiell um die Tool-Ausführung ([src/tools/registry.ts](src/tools/registry.ts)); blockiert weder Agent noch Batch, ein absichtlich flaky Mock-Tool beweist es im Eval.
- **Resume** — Checkpoint pro terminalem Item (atomar via tmp+rename, [src/orchestrator/checkpoint.ts](src/orchestrator/checkpoint.ts)); überlebt Server-Neustarts. `completed`/`failed` werden übernommen (nicht doppelt bezahlt; ein Step-Cap-Runaway würde wieder weglaufen), `aborted`/`pending` laufen neu. Trade-off: Tokens eines mid-flight gekillten Agenten werden neu bezahlt — bewusst, dafür kein Transcript-Persist.

## Architektur

```
app/                  Next.js-Schicht (Dashboard + 4 Routes: start, SSE-Events, kill, resume)
src/                  framework-freier Kern — der Eval importiert ihn ohne Next.js
  orchestrator/       Worker-Pool · TokenBudget (reserve→commit) · Run-Store · Checkpoints · Orchestrator
  agent/agent-loop.ts alle Caps, Strikes, Terminierungsregeln
  tools/              4 deterministische Mock-Tools + zod-Registry
  llm/                LLMClient-Interface · Anthropic (Haiku) · deterministischer Mock · Pricing
eval/                 run-eval.ts (Assertions) · smoke.ts (Demo-Batch)
```

Live-Status läuft über SSE (Snapshot bei Connect, dann Tail — Reconnect braucht kein
Event-Replay). Der Batch startet fire-and-forget aus dem POST-Handler: lokal ist das ein
langlebiger Node-Prozess, nicht serverless. Ein aktiver Run gleichzeitig (sonst 409),
damit die Globale-Budget-Semantik eindeutig bleibt.

## Was ich mit mehr Zeit gemacht hätte

- Transcript-Replay beim Resume, damit auch mid-flight verbrannte Tokens gerettet werden
- Token-Schätzung über den `count_tokens`-Endpoint statt der chars/3-Heuristik (Reservierungen würden enger, mehr nutzbares Budget)
- Drosseln als Alternative zum sauberen Stopp (Budget-Restmenge auf wartende Agenten verteilen)
- Persistenz (SQLite) statt in-memory, Multi-Run-Historie im UI
- E2E-Test der SSE-/UI-Schicht (Playwright), CI-Workflow für `npm run eval`

## Stack & Tools

Next.js 16 (App Router) · TypeScript strict · Tailwind v4 · `@anthropic-ai/sdk` ·
zod v4. Gebaut mit Claude Code (laut Aufgabe explizit erwünscht) — Architektur,
Mechanik-Entscheidungen und Review von mir, Tipparbeit vom Agenten.
