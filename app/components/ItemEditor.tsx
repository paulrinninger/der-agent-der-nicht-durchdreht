"use client";

import { useEffect, useRef, useState } from "react";
import type { RunMode, Usage } from "@/src/types";
import { num } from "./labels";

/**
 * Item-Editor als Drawer im Design-Stil: eigene Ideen rein, KI-erfundene
 * rein, Defaults zurück. Items sind lifted state (page.tsx + localStorage).
 */

export interface EditorItem {
  name: string;
  pitch: string;
  chaos: boolean;
}

interface GenResult {
  n: number;
  source: "haiku" | "offline";
  tokens?: number;
  costUsd?: number;
}

const supportsFieldSizing =
  typeof CSS !== "undefined" && CSS.supports("field-sizing", "content");

function autoGrow(el: HTMLTextAreaElement): void {
  if (supportsFieldSizing) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight + 2, 144)}px`;
}

export function ItemEditor({
  open,
  items,
  defaults,
  mode,
  chaosPresetActive,
  onChange,
  onClose,
}: {
  open: boolean;
  items: EditorItem[] | null;
  defaults: EditorItem[];
  mode: RunMode;
  chaosPresetActive: boolean;
  onChange: (items: EditorItem[] | null) => void;
  onClose: () => void;
}) {
  const [genCount, setGenCount] = useState(5);
  const [theme, setTheme] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<GenResult | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    addRef.current?.focus({ preventScroll: true });
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  const rows = items ?? defaults;
  const isCustom = items !== null;

  const mutate = (next: EditorItem[]): void => onChange(next.length === 0 ? null : next);
  const update = (i: number, patch: Partial<EditorItem>): void =>
    mutate(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const remove = (i: number): void => mutate(rows.filter((_, j) => j !== i));
  const add = (): void => mutate([{ name: "", pitch: "", chaos: false }, ...rows]);

  const generate = async (): Promise<void> => {
    setGenerating(true);
    setGenError(null);
    setGenResult(null);
    try {
      const res = await fetch("/api/items/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: genCount, theme: theme.trim() || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        items?: { name: string; pitch: string }[];
        source?: "haiku" | "offline";
        usage?: Usage;
        costUsd?: number;
        error?: string;
      };
      if (!res.ok || !data.items) {
        setGenError(data.error ?? `Fehler ${res.status}`);
        return;
      }
      mutate([...data.items.map((i) => ({ ...i, chaos: false })), ...rows]);
      setGenResult({
        n: data.items.length,
        source: data.source ?? "offline",
        tokens: data.usage ? data.usage.inputTokens + data.usage.outputTokens : undefined,
        costUsd: data.costUsd,
      });
    } catch {
      setGenError("Anfrage fehlgeschlagen.");
    } finally {
      setGenerating(false);
    }
  };

  const n = rows.length;

  return (
    <div className="fixed inset-0 z-[55]">
      <div className="scrim" onClick={onClose} />
      <aside
        className="drawer drawer-wide"
        role="dialog"
        aria-modal="true"
        aria-label="Item-Editor"
      >
        <header className="drawer-head">
          <div>
            <span className="label">Items · {n}</span>
            <h2 className="drawer-title">Eigene Ideen</h2>
            <p className="caption" style={{ margin: "6px 0 0" }}>
              Jede Idee bekommt einen eigenen Agenten. Änderungen gelten ab dem nächsten Lauf.
            </p>
          </div>
          <div className="controls-right" style={{ flexShrink: 0 }}>
            {isCustom && (
              <button className="btn btn-ghost" onClick={() => onChange(null)}>
                ↺ Zurücksetzen
              </button>
            )}
            <button className="btn btn-ghost" onClick={onClose}>
              Schließen
            </button>
          </div>
        </header>

        {/* Generator */}
        <div className="gen-box">
          <p className="label" style={{ marginBottom: 8 }}>
            ✨ Neue Ideen erfinden lassen
          </p>
          <div className="controls-right" style={{ justifyContent: "flex-start" }}>
            <div className="seg" role="radiogroup" aria-label="Wie viele Ideen">
              {[3, 5, 10].map((c) => (
                <button
                  key={c}
                  className={"seg-btn mono" + (genCount === c ? " active" : "")}
                  onClick={() => setGenCount(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <input
              className="input"
              style={{ flex: 1, minWidth: 140 }}
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              maxLength={80}
              placeholder="Thema (optional) — z. B. Fake-Cocktails"
              aria-label="Thema"
            />
            <button className="btn" onClick={generate} disabled={generating}>
              ✨ Erfinden
            </button>
          </div>
          <p aria-live="polite" className="mono" style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
            {generating ? (
              "Haiku denkt sich Quatsch-Startups aus…"
            ) : genError ? (
              <span className="danger">{genError}</span>
            ) : genResult ? (
              genResult.source === "haiku" ? (
                `${genResult.n} Ideen · ${num(genResult.tokens ?? 0)} Tokens · $${(genResult.costUsd ?? 0).toFixed(4)}`
              ) : (
                `${genResult.n} Ideen · offline erfunden — ohne KI`
              )
            ) : (
              "Haiku hängt neue Quatsch-Startups oben an die Liste."
            )}
          </p>
        </div>

        {/* Liste */}
        <div className="drawer-body" style={{ gap: 10 }}>
          <button ref={addRef} className="btn btn-ghost" style={{ alignSelf: "flex-start" }} onClick={add}>
            ＋ Neue Idee
          </button>
          {generating &&
            Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="item-row" style={{ opacity: 0.5 }}>
                <span className="mono faint-c">··</span>
                <div className="mono muted-c" style={{ fontSize: 12 }}>
                  wird erfunden…
                </div>
                <div />
              </div>
            ))}
          {rows.map((it, i) => {
            const invalid = !it.name.trim() || !it.pitch.trim();
            return (
              <div key={i} className="item-row">
                <span className="mono faint-c" style={{ paddingTop: 26, fontSize: 11 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <label htmlFor={`it-${i}-name`} className="field-label">
                      Name
                    </label>
                    <input
                      id={`it-${i}-name`}
                      className="input"
                      style={{ width: "100%" }}
                      value={it.name}
                      onChange={(e) => update(i, { name: e.target.value })}
                      maxLength={60}
                      placeholder="z. B. Uber für Socken"
                    />
                  </div>
                  <div>
                    <label htmlFor={`it-${i}-pitch`} className="field-label">
                      Pitch — ein Satz, der die Idee verkauft
                    </label>
                    <textarea
                      id={`it-${i}-pitch`}
                      rows={2}
                      maxLength={200}
                      placeholder="Was macht das Startup, und warum klingt es fast plausibel?"
                      className="input field-area"
                      value={it.pitch}
                      onChange={(e) => update(i, { pitch: e.target.value })}
                      onInput={(e) => autoGrow(e.currentTarget)}
                      ref={(el) => {
                        if (el) autoGrow(el);
                      }}
                    />
                  </div>
                  {invalid && (
                    <p className="danger" style={{ fontSize: 11.5 }}>
                      Name und Pitch dürfen nicht leer sein
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <button
                    onClick={() => update(i, { chaos: !it.chaos })}
                    disabled={mode === "anthropic"}
                    aria-pressed={it.chaos}
                    data-tip={
                      mode === "anthropic"
                        ? "Szenarien wirken nur im Demo-Modus"
                        : "Lässt diesen Agenten im Demo-Modus absichtlich durchdrehen — Vorführung fürs Step-Cap."
                    }
                    data-tip-pos="bottom"
                    className={"btn" + (it.chaos ? " btn-kill" : " btn-ghost")}
                    style={{ fontSize: 12, padding: "5px 10px" }}
                  >
                    💥
                  </button>
                  <button
                    onClick={() => remove(i)}
                    aria-label={`Idee löschen: ${it.name || `Nr. ${i + 1}`}`}
                    className="btn btn-ghost"
                    style={{ fontSize: 12, padding: "5px 10px" }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px solid var(--line)", padding: "12px 24px 18px" }}>
          {chaosPresetActive && (
            <p className="warn mono" style={{ fontSize: 11.5, marginBottom: 6 }}>
              ▲ Szenario „Agenten drehen durch“ aktiv — der nächste Lauf nutzt die Chaos-Items,
              nicht diese Liste.
            </p>
          )}
          <p className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>
            {n} Ideen ·{" "}
            <span data-tip="Ein Call = eine Anfrage ans Sprachmodell. Pro Idee typisch: Recherche, Entwurf, Kritik, Finalisieren.">
              ~{n * 4} KI-Calls
            </span>{" "}
            · ≈ {num(n * 4 * 310)} Tokens · Demo 0 $ · Claude Haiku ≈{" "}
            {(n * 0.015).toFixed(2).replace(".", ",")} $
          </p>
        </div>
      </aside>
    </div>
  );
}
