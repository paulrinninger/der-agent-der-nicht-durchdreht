import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { costUsd, MODEL_ID } from "@/src/llm/pricing";
import { hasApiKey } from "@/src/server/instance";
import { clampGenerated, generateRequestSchema } from "../../_lib/items";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Invents silly startup ideas. With an API key: claude-haiku-4-5 via
 * structured outputs (json_schema), real cost reported. Without: a local
 * deterministic combinator, honestly labeled "offline".
 * Independent of the run system — never touches the orchestrator or budget.
 */

const GEN_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Startup-Name, deutsch, maximal 6 Wörter, maximal 60 Zeichen",
          },
          pitch: {
            type: "string",
            description: "Ein-Satz-Pitch, deutsch, maximal 25 Wörter, maximal 200 Zeichen",
          },
        },
        required: ["name", "pitch"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;
// structured outputs reject maxLength/minItems — lengths live in descriptions,
// clamped server-side. (If output_config were ever unavailable, the equivalent
// fallback is a single forced tool `submit_items` with this input_schema and
// tool_choice {type:"tool"}.)

const SYSTEM_PROMPT = `Du erfindest absichtlich absurde Startup-Ideen für das Demo-Dashboard einer KI-Agentur.

Ton: trocken, deutsch, eine Prise Berlin — Tech-Buzzword trifft banalen Alltag. Der Witz entsteht daraus, dass eine offensichtlich bescheuerte Idee völlig geschäftsmodell-ernst formuliert wird. Kein "haha", keine Emojis, der Witz wird nie erklärt.

Regeln:
- name: prägnant, maximal 6 Wörter (Muster wie "Uber für Socken" sind gut)
- pitch: genau ein Satz, maximal 25 Wörter, todernst formuliert
- Buzzword-Hygiene: pro Charge maximal je 1× Blockchain, 1× KI, 1× Quanten, 1× NFT
- keine real existierenden Firmen, außer als Schablone ("X für Y")
- jede Idee muss als Geschäftsmodell *fast* plausibel klingen

Beispiele für exakt diesen Ton:
- name: "Sauerteig-Sitting" — pitch: "Urlaubsbetreuung für Sauerteige. Liebevoll gefüttert, täglich Foto-Update."
- name: "Quanten-Kaffee" — pitch: "Gleichzeitig stark und entkoffeiniert, bis du ihn beobachtest."
- name: "Meeting-Escape-Knopf" — pitch: "Hardware-Knopf unterm Tisch: simuliert Netzwerkprobleme auf Knopfdruck."`;

const userPrompt = (count: number, theme?: string): string =>
  `Erfinde ${count} neue Quatsch-Startup-Ideen.` +
  (theme ? ` Thema: „${theme}“ — jede Idee muss erkennbar damit zu tun haben.` : "") +
  ` Keine Dubletten zu den Beispielen.`;

// ---------- offline fallback (no key needed, honestly labeled) ----------

const PREFIX = ["blockchain für", "uber für", "ki-gestützte", "abo-box für", "quanten-", "vr-", "drohnen-basierte", "serverless"];
const OBJECT = ["wetterfühlige rolltreppen", "gartenzwerge", "wartemarken", "gießkannen", "bürostühle", "currywurst", "hausschuhe", "kellertreppen"];
const PITCH = [
  (o: string) => `Endlich ${o} mit Series-A-Potenzial. Der Markt hat nicht danach gefragt.`,
  (o: string) => `Disruptiert ${o} grundlegend. Vorher war auch nichts kaputt.`,
  (o: string) => `${o.charAt(0).toUpperCase() + o.slice(1)}, aber als Plattform. Abo ab 9,99 €.`,
  (o: string) => `Das Betriebssystem für ${o}. Kategorie selbst erfunden, Marktführer sofort.`,
];

function offlineItems(count: number, theme?: string): { name: string; pitch: string }[] {
  const seed = Date.now();
  const out: { name: string; pitch: string }[] = [];
  const seen = new Set<string>();
  for (let i = 0; out.length < count && i < count * 4; i++) {
    const p = PREFIX[(seed + i * 7) % PREFIX.length];
    const o = theme ? `${theme}-${OBJECT[(seed + i * 11) % OBJECT.length]}` : OBJECT[(seed + i * 11) % OBJECT.length];
    const name = `${p} ${o}`.replace(/- /g, "-").slice(0, 60);
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ name, pitch: PITCH[(seed + i * 13) % PITCH.length](o).slice(0, 200) });
  }
  return out;
}

// one generation at a time (belt-and-braces; the client also guards)
let inFlight = false;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = generateRequestSchema.safeParse({
    count: typeof body.count === "number" ? body.count : undefined,
    theme: typeof body.theme === "string" && body.theme.trim() ? body.theme : undefined,
  });
  const { count, theme } = parsed.success ? parsed.data : { count: 5, theme: undefined };

  if (!hasApiKey()) {
    return NextResponse.json({ items: offlineItems(count, theme), source: "offline" });
  }

  if (inFlight) {
    return NextResponse.json({ error: "es läuft bereits eine generierung." }, { status: 429 });
  }
  inFlight = true;
  try {
    const client = new Anthropic({ maxRetries: 2 });
    const response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt(count, theme) }],
      output_config: { format: { type: "json_schema", schema: GEN_SCHEMA } },
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const items = clampGenerated(JSON.parse(text), count);
    if (items.length === 0) throw new Error("Modell lieferte keine verwertbaren Ideen");
    const usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
    return NextResponse.json({ items, source: "haiku", usage, costUsd: costUsd(usage) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `ki-generierung fehlgeschlagen: ${msg}` }, { status: 502 });
  } finally {
    inFlight = false;
  }
}
