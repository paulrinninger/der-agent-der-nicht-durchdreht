import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RunState } from "../types";

/**
 * One JSON checkpoint per run, written after every item reaches a terminal
 * state (not per event). tmp-file + rename keeps the write atomic — a crash
 * mid-write can never corrupt the checkpoint a resume depends on.
 */
export class CheckpointStore {
  constructor(private readonly dir: string = ".runs") {
    mkdirSync(this.dir, { recursive: true });
  }

  save(run: RunState): void {
    const path = join(this.dir, `${run.id}.json`);
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, JSON.stringify(run, null, 2), "utf8");
    renameSync(tmp, path);
  }

  load(id: string): RunState | null {
    try {
      return JSON.parse(readFileSync(join(this.dir, `${id}.json`), "utf8")) as RunState;
    } catch {
      return null;
    }
  }

  /** newest checkpoint first — the dashboard offers resuming the latest run */
  latest(): RunState | null {
    try {
      const files = readdirSync(this.dir).filter((f) => f.endsWith(".json"));
      let best: RunState | null = null;
      for (const f of files) {
        const run = this.load(f.replace(/\.json$/, ""));
        if (run && (!best || run.startedAt > best.startedAt)) best = run;
      }
      return best;
    } catch {
      return null;
    }
  }
}
