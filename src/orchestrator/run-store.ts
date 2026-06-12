import type { RunEvent, RunState } from "../types";

/**
 * In-memory run state + pub/sub for live updates. Framework-free — the
 * Next.js layer wraps a single instance in a globalThis singleton (HMR-safe),
 * the eval creates its own throwaway instance.
 */
export class RunStore {
  private readonly runs = new Map<string, RunState>();
  private readonly subscribers = new Map<string, Set<(e: RunEvent) => void>>();

  create(run: RunState): void {
    this.runs.set(run.id, run);
  }

  get(id: string): RunState | undefined {
    return this.runs.get(id);
  }

  list(): RunState[] {
    return [...this.runs.values()].sort((a, b) => b.startedAt - a.startedAt);
  }

  subscribe(runId: string, fn: (e: RunEvent) => void): () => void {
    let set = this.subscribers.get(runId);
    if (!set) {
      set = new Set();
      this.subscribers.set(runId, set);
    }
    set.add(fn);
    return () => {
      set.delete(fn);
      if (set.size === 0) this.subscribers.delete(runId);
    };
  }

  emit(runId: string, event: RunEvent): void {
    const set = this.subscribers.get(runId);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(event);
      } catch {
        // a broken subscriber (e.g. disconnected SSE) must never affect the run
      }
    }
  }
}
