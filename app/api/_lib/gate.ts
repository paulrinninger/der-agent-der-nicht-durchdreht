/**
 * Passwort-Gate für das öffentliche Deployment. Bewusst simpel gehalten:
 * Es schützt die Demo vor Zufallstraffic — nicht vor Lesern des (öffentlichen)
 * Quellcodes, die ohnehin alles lokal starten können. Das Passwort ist das
 * der Aufgaben-Seite, damit das Review-Team nichts Neues braucht.
 */
export const GATE_PASSWORD = process.env.GATE_PASSWORD ?? "lfgo-diffusion";
export const GATE_COOKIE = "agency_gate";
export const GATE_TOKEN = "lfgo-diffusion-ok-v1";
