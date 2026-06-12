import { z } from "zod";
import type { BatchItem } from "../types";

/**
 * Mock tools — deterministic, seeded by their inputs. The point of this
 * project is loop control, not tool quality (per assignment).
 */

export interface ToolContext {
  item: BatchItem;
  /** 0-based attempt number, provided by the retry wrapper */
  attempt: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ToolDefinition<S extends z.ZodType = any> {
  name: string;
  description: string;
  schema: S;
  execute: (args: z.infer<S>, ctx: ToolContext) => string;
}

/** tiny deterministic string hash (fnv-1a) for "seeded" fake numbers */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const research: ToolDefinition = {
  name: "research",
  description:
    "Liefert Marktdaten zu einem Thema (Marktgröße, Wachstum, Wettbewerber). Immer der erste Schritt.",
  schema: z.object({
    topic: z.string().min(1).describe("Das Thema, zu dem recherchiert werden soll"),
  }),
  execute: ({ topic }, ctx) => {
    // the flaky-tool scenario fails transiently on the first attempt of each
    // call — the retry/backoff wrapper has to save it
    if (ctx.item.scenario === "flaky-tool" && ctx.attempt === 0) {
      throw new Error("research: upstream timeout (transient)");
    }
    const h = hash(topic);
    const size = 100 + (h % 900);
    const growth = 2 + (h % 38);
    const competitors = h % 7;
    return (
      `Marktanalyse „${topic}“: Marktvolumen ca. ${size} Mio. €, ` +
      `Wachstum ${growth} % p. a., ${competitors} ernstzunehmende Wettbewerber. ` +
      `Analystenzitat: „Das ist entweder genial oder Quatsch — vermutlich beides.“`
    );
  },
};

const draft: ToolDefinition = {
  name: "draft",
  description: "Erstellt eine Kurzbewertung aus Thema und Recherche-Erkenntnissen.",
  schema: z.object({
    topic: z.string().min(1).describe("Das bewertete Startup"),
    insights: z.string().describe("Erkenntnisse aus der Recherche"),
  }),
  execute: ({ topic, insights }) => {
    const angle = hash(topic) % 3;
    const tone = ["mutig, aber machbar", "charmant sinnlos", "überraschend investierbar"][angle];
    return (
      `Entwurf zu „${topic}“: Die Idee wirkt ${tone}. ` +
      `Basis: ${insights.slice(0, 120)}… Empfehlung folgt nach Kritik.`
    );
  },
};

const critique: ToolDefinition = {
  name: "critique",
  description: "Prüft einen Entwurf und vergibt einen Score (0–100) mit Feedback.",
  schema: z.object({
    draft: z.string().min(1).describe("Der zu prüfende Entwurf"),
  }),
  execute: ({ draft: text }) => {
    const score = 55 + (hash(text) % 41);
    const nit = hash(text) % 2 === 0 ? "Marktgröße wirkt optimistisch." : "Wettbewerb unterschätzt.";
    return `Kritik: Score ${score}/100. ${nit} Sonst tragfähig — bitte finalisieren.`;
  },
};

const finalize: ToolDefinition = {
  name: "finalize",
  description:
    "Schließt die Bewertung ab und liefert das Endergebnis. MUSS als letzter Schritt aufgerufen werden.",
  schema: z.object({
    summary: z.string().min(1).describe("Finale Zusammenfassung der Bewertung"),
    verdict: z.enum(["invest", "pass"]).describe("Investieren oder nicht"),
  }),
  execute: ({ summary, verdict }) =>
    `${verdict === "invest" ? "💸 INVEST" : "🙅 PASS"} — ${summary}`,
};

export const TOOL_DEFINITIONS: ToolDefinition[] = [research, draft, critique, finalize];

/** the tool whose successful execution terminates an agent */
export const TERMINAL_TOOL = "finalize";
