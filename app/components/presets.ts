import type { MockScenario } from "@/src/types";

/**
 * Die drei Demo-Läufe (Szenario-Tabs im Design-Mockup). Anders als das
 * Mockup hat die echte Engine bewusst KEINEN „naiv, ohne limits"-Modus —
 * die Caps sind nicht abschaltbar. Budget-Crunch zeigt stattdessen ehrlich,
 * was der Kill-Switch tut, wo der naive Bau explodieren würde.
 */

export interface PresetDef {
  key: "kontrolliert" | "chaos" | "crunch";
  label: string;
  hint: string;
  budget: number;
  concurrency: number;
}

export const PRESETS: PresetDef[] = [
  {
    key: "kontrolliert",
    label: "Kontrollierter Lauf",
    hint: "Limit 3, harte Caps, jeder Tool-Call validiert. Die Agenten finden ihr Ende selbst — der Batch bleibt unter Budget.",
    budget: 200_000,
    concurrency: 3,
  },
  {
    key: "chaos",
    label: "Agenten drehen durch",
    hint: "Sechs von 15 Agenten benehmen sich absichtlich daneben — Runaways, kaputte Argumente, erfundene Tools. Die Sicherungen stoppen jeden einzeln, der Rest läuft sauber weiter (nur Demo-Modus).",
    budget: 200_000,
    concurrency: 3,
  },
  {
    key: "crunch",
    label: "Budget-Crunch",
    hint: "Nur 10.000 Tokens für 15 Items. Das Budget reißt mittendrin — der Kill-Switch stoppt den Lauf sauber, statt es erst nach 10.000 verbrannten Tokens zu merken.",
    budget: 10_000,
    concurrency: 3,
  },
];

export interface PresetItem {
  name: string;
  pitch: string;
  scenario: MockScenario;
}

/** 6 Störenfriede (4 verschiedene Sicherungen feuern) + 9 ehrliche Items */
export const CHAOS_ITEMS: PresetItem[] = [
  { name: "KI-Staubsauger mit Doktortitel", pitch: "Promoviert in Krümelforschung. Recherchiert lieber, statt je zu saugen.", scenario: "runaway" },
  { name: "Endlos-Podcast-Generator", pitch: "Eine Folge, die nie endet. Unser Agent übrigens auch nicht.", scenario: "runaway" },
  { name: "Perpetuum-Mobile als App", pitch: "Läuft und läuft und läuft. Genau das ist das Problem.", scenario: "runaway" },
  { name: "Formular-Ausfüll-Roboter", pitch: "Füllt jedes Formular aus. Leider immer die falschen Felder.", scenario: "broken-args" },
  { name: "Einhorn-Logistik", pitch: "Lieferung per Fabelwesen. Das Tool dafür muss nur noch erfunden werden.", scenario: "invented-tool" },
  { name: "Meditations-App für Workaholics", pitch: "Findet nie einen Abschluss. Sagt einfach irgendwann nichts mehr.", scenario: "no-finalize" },
  { name: "Lastenrad-Carsharing für Hamster", pitch: "Mikromobilität, wörtlich genommen.", scenario: "happy" },
  { name: "Späti-Sommelier", pitch: "Weinberatung am Kühlregal, nachts um drei.", scenario: "happy" },
  { name: "Cloud-Kompost", pitch: "Dein Biomüll, aber serverless.", scenario: "happy" },
  { name: "Yoga für Drucker", pitch: "Löst Papierstau durch Achtsamkeit.", scenario: "happy" },
  { name: "Bürostuhl-Flugmeilen", pitch: "Rollweg im Großraumbüro wird endlich belohnt.", scenario: "happy" },
  { name: "Geisterküche für Astronauten", pitch: "Ghost Kitchen, nur höher.", scenario: "happy" },
  { name: "Pfandflaschen-Index-Fonds", pitch: "8 Cent Rendite, physisch besichert.", scenario: "happy" },
  { name: "Wetter-Abo ohne Regen", pitch: "Premium-Tier: nur Hochdruckgebiete.", scenario: "happy" },
  { name: "Anrufbeantworter-Coaching", pitch: "Endlich souverän aufs Band sprechen.", scenario: "happy" },
];
