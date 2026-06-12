import { z } from "zod";
import type { BatchItem, MockScenario } from "@/src/types";

/**
 * Shared validation for user-supplied items (underscore folder = not routed).
 * The core (src/) stays untouched — custom items flow through the existing
 * RunConfig.items; this layer just makes sure nothing malformed gets there.
 */

export const SCENARIOS = [
  "happy",
  "runaway",
  "invented-tool",
  "broken-args",
  "crasher",
  "no-finalize",
  "flaky-tool",
] as const satisfies readonly MockScenario[];

export const itemInputSchema = z.object({
  name: z.string().trim().min(1, "name fehlt").max(60, "name max. 60 zeichen"),
  pitch: z.string().trim().min(1, "pitch fehlt").max(200, "pitch max. 200 zeichen"),
  scenario: z.enum(SCENARIOS).optional(),
});

export const itemsPayloadSchema = z.array(itemInputSchema).min(1).max(200);

/** umlaut-aware, deterministic: "KI-Toaster für Bäcker" -> "ki-toaster-fuer-baecker" */
export function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || "item";
}

/** unique ids via -2, -3 …, checked against the FINAL id set (a literal "x-2" input can't collide) */
export function toBatchItems(items: z.infer<typeof itemsPayloadSchema>): BatchItem[] {
  const taken = new Set<string>();
  return items.map((it) => {
    const base = slugify(it.name);
    let id = base;
    for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;
    taken.add(id);
    return { id, name: it.name, pitch: it.pitch, scenario: it.scenario ?? "happy" };
  });
}

// ---------- generator ----------

export const generateRequestSchema = z.object({
  count: z.number().int().min(1).max(15).catch(5),
  theme: z.string().trim().max(80).optional(),
});

const rawGenSchema = z.object({
  items: z.array(z.object({ name: z.string(), pitch: z.string() })),
});

/** lenient parse + clamp — a 61-char name must not fail the whole batch */
export function clampGenerated(raw: unknown, count: number): { name: string; pitch: string }[] {
  const parsed = rawGenSchema.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data.items
    .map((i) => ({ name: i.name.trim().slice(0, 60), pitch: i.pitch.trim().slice(0, 200) }))
    .filter((i) => i.name && i.pitch)
    .slice(0, count);
}
