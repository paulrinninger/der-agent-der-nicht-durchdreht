import type { MockScenario } from "@/src/types";

/**
 * The three demo runs, mirroring the diffusion task page 1:1:
 * "kontrollierter lauf · ok" · "agent dreht durch · gestoppt" · "budget".
 */

export interface PresetDef {
  key: "kontrolliert" | "chaos" | "crunch";
  label: string;
  tag: string;
  tagClass: string;
  hint: string;
  budget: number;
  concurrency: number;
}

export const PRESETS: PresetDef[] = [
  {
    key: "kontrolliert",
    label: "kontrollierter lauf",
    tag: "ok",
    tagClass: "text-ok-soft",
    hint: "15 normale items, 200.000 tokens — läuft sauber durch. der happy path.",
    budget: 200_000,
    concurrency: 3,
  },
  {
    key: "chaos",
    label: "chaos-crew",
    tag: "gestoppt",
    tagClass: "text-err-soft",
    hint: "6 von 15 agenten drehen absichtlich durch — zeigt live, wie die sicherungen greifen (nur demo-modus).",
    budget: 200_000,
    concurrency: 3,
  },
  {
    key: "crunch",
    label: "budget-crunch",
    tag: "budget",
    tagClass: "text-warn-soft",
    hint: "nur 10.000 tokens für 15 items — das budget reißt mittendrin und der lauf stoppt sauber.",
    budget: 10_000,
    concurrency: 3,
  },
];

export interface PresetItem {
  name: string;
  pitch: string;
  scenario: MockScenario;
}

/** 6 misbehaving agents (4 different guards fire) + 9 honest ones */
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
