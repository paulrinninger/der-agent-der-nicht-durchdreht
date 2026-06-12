import type { BatchItem } from "./types";

/**
 * 15 Quatsch-Startups. Im Mock-Modus steuert `scenario` das Verhalten des
 * Mock-LLM — drei Items zeigen die Schutzmechanismen live (Runaway,
 * erfundenes Tool, flaky Tool). Der echte Haiku-Client ignoriert `scenario`.
 */
export const BATCH_ITEMS: BatchItem[] = [
  { id: "socken", name: "Uber für Socken", pitch: "Einzelsocken-Sharing: dein verlorener Socken ist irgendwo — wir matchen.", scenario: "happy" },
  { id: "katzenklo", name: "Blockchain für Katzenklos", pitch: "Jeder Toilettengang on-chain. Proof-of-Stuhl.", scenario: "happy" },
  { id: "toaster", name: "KI-Toaster as a Service", pitch: "Der Toaster lernt deinen Bräunungsgrad. Abo: 9,99 €/Monat pro Scheibe.", scenario: "runaway" },
  { id: "pflanzen", name: "Dating-App für Zimmerpflanzen", pitch: "Monstera sucht Monstera. Swipe right für Photosynthese.", scenario: "happy" },
  { id: "luft", name: "Abo-Box für Luft", pitch: "Bergluft aus Garmisch im Weckglas, monatlich kuratiert.", scenario: "happy" },
  { id: "regenschirm", name: "NFT-Regenschirme", pitch: "Der Schirm ist digital. Nass wirst du trotzdem, aber exklusiv.", scenario: "invented-tool" },
  { id: "kaffee", name: "Quanten-Kaffee", pitch: "Gleichzeitig stark und entkoffeiniert, bis du ihn beobachtest.", scenario: "happy" },
  { id: "kompost", name: "KI-Kompostflüsterer", pitch: "Sentiment-Analyse für deinen Biomüll. Der Kompost hat Gefühle.", scenario: "happy" },
  { id: "giesskanne", name: "Smart-Gießkanne mit Burnout-Erkennung", pitch: "Erkennt, wenn deine Pflanze nicht mehr kann. Und du auch nicht.", scenario: "flaky-tool" },
  { id: "spaeti", name: "Späti-Drohnen für Club-Mate", pitch: "Letzte Meile, letzte Runde: Mate-Lieferung per Drohne nach 2 Uhr.", scenario: "happy" },
  { id: "wartezimmer", name: "VR-Wartezimmer", pitch: "Warte beim Amt, ohne beim Amt zu sein. Die Nummer ziehst du virtuell.", scenario: "happy" },
  { id: "lastenrad", name: "Lastenrad-Valet-Parking", pitch: "Einparkservice für Premium-Lastenräder in Prenzlauer Berg.", scenario: "happy" },
  { id: "horoskop", name: "Horoskop-API für B2B", pitch: "REST-Endpunkt für Merkur-Retrograde. SLA: 99,9 % Sternenklarheit.", scenario: "happy" },
  { id: "sauerteig", name: "Sauerteig-Sitting", pitch: "Urlaubsbetreuung für Sauerteige. Liebevoll gefüttert, täglich Foto-Update.", scenario: "happy" },
  { id: "meeting", name: "Meeting-Escape-Knopf", pitch: "Hardware-Knopf unterm Tisch: simuliert Netzwerkprobleme auf Knopfdruck.", scenario: "happy" },
];
