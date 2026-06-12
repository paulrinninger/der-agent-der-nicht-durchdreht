"use client";

import { useEffect, useRef, useState } from "react";
import type { RunMode, Usage } from "@/src/types";
import { num } from "./labels";

/**
 * Item editor sheet: own ideas in, AI-invented ideas in, defaults out.
 * Items are lifted state (page.tsx owns them + localStorage); the editor
 * never starts runs. null = defaults (the 15 built-in startups).
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

  // first edit of the default list materializes it as custom
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
        setGenError(data.error ?? `fehler ${res.status}`);
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
      setGenError("anfrage fehlgeschlagen.");
    } finally {
      setGenerating(false);
    }
  };

  const n = rows.length;

  return (
    <div className="fixed inset-0 z-[55]">
      <div className="drawer-backdrop absolute inset-0" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="item-editor"
        className="glass-sheet drawer-sheet absolute bottom-2 right-2 top-2 flex w-[min(36rem,calc(100vw-1rem))] flex-col p-5 sm:bottom-3 sm:right-3 sm:top-3"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold lowercase">items · {n}</h2>
          <div className="flex items-center gap-2">
            {isCustom && (
              <button onClick={() => onChange(null)} className="puck cursor-pointer hover:text-ink">
                ↺ zurücksetzen
              </button>
            )}
            <button onClick={onClose} aria-label="Schließen" className="btn h-11 w-11 rounded-full p-0 text-ink-dim">
              ✕
            </button>
          </div>
        </div>

        {/* generator strip */}
        <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="seg">
              {[3, 5, 10].map((c) => (
                <button
                  key={c}
                  onClick={() => setGenCount(c)}
                  className={`seg-item ${genCount === c ? "seg-item-active" : ""}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              maxLength={80}
              placeholder="thema (optional), z. b. „fake-cocktails“"
              aria-label="thema"
              className="field min-w-0 flex-1 text-sm"
            />
            <button onClick={generate} disabled={generating} className="btn btn-positive">
              ✨ per ki erfinden
            </button>
          </div>
          <p aria-live="polite" className="mt-2 font-mono text-[11px] text-ink-dim">
            {generating
              ? "haiku denkt sich quatsch aus…"
              : genError
                ? <span className="text-err-soft">{genError}</span>
                : genResult
                  ? genResult.source === "haiku"
                    ? `${genResult.n} ideen · ${num(genResult.tokens ?? 0)} tokens · $${(genResult.costUsd ?? 0).toFixed(4)}`
                    : `${genResult.n} ideen · offline erfunden — ohne ki`
                  : "erfindet neue quatsch-startups und hängt sie oben an die liste."}
          </p>
        </div>

        {/* list */}
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          <button ref={addRef} onClick={add} className="puck cursor-pointer hover:text-ink">
            ＋ neue idee
          </button>
          {generating &&
            Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="item-row opacity-50">
                <span className="shimmer font-mono text-xs">··</span>
                <div className="shimmer font-mono text-xs">wird erfunden…</div>
              </div>
            ))}
          {rows.map((it, i) => {
            const invalid = !it.name.trim() || !it.pitch.trim();
            return (
              <div key={i} className="item-row">
                <span className="pt-2 font-mono text-[11px] text-ink-dim">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <input
                    value={it.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                    maxLength={60}
                    placeholder="name"
                    aria-label={`name von item ${i + 1}`}
                    className="field h-9 w-full text-sm"
                  />
                  <input
                    value={it.pitch}
                    onChange={(e) => update(i, { pitch: e.target.value })}
                    maxLength={200}
                    placeholder="pitch (ein satz)"
                    aria-label={`pitch von item ${i + 1}`}
                    className="field mt-1.5 h-9 w-full text-xs"
                  />
                  {invalid && <p className="mt-1 text-[10px] text-err-soft">name und pitch dürfen nicht leer sein</p>}
                </div>
                <button
                  onClick={() => update(i, { chaos: !it.chaos })}
                  disabled={mode === "anthropic"}
                  aria-pressed={it.chaos}
                  title={
                    mode === "anthropic"
                      ? "szenarien wirken nur im mock-modus"
                      : "💥 absichtlich durchdrehen lassen (nur mock)"
                  }
                  className={`puck h-9 cursor-pointer justify-center px-2 ${
                    it.chaos ? "border-err/40 text-err-soft" : "opacity-60"
                  } disabled:cursor-not-allowed disabled:opacity-30`}
                >
                  💥
                </button>
                <button
                  onClick={() => remove(i)}
                  aria-label={`item löschen: ${it.name || `nr. ${i + 1}`}`}
                  className="puck h-9 cursor-pointer justify-center px-2 hover:text-err-soft"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        {/* footer */}
        <div className="mt-3 border-t border-white/5 pt-3">
          {chaosPresetActive && (
            <p className="mb-2 font-mono text-[10px] text-warn-soft">
              ⚠ preset „chaos-crew“ aktiv — der nächste lauf nutzt die chaos-items, nicht diese liste.
            </p>
          )}
          <p className="font-mono text-[10px] text-ink-dim">
            {n} items ≈ {n * 4} calls ≈ {num(n * 4 * 310)} tokens · mock $0 · haiku grob ~
            {(n * 0.015).toFixed(2).replace(".", ",")} $
          </p>
          <button onClick={onClose} className="btn mt-2 w-full">
            fertig
          </button>
        </div>
      </aside>
    </div>
  );
}
