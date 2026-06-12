import { NextResponse } from "next/server";
import { BATCH_ITEMS } from "@/src/items";
import { hasApiKey, server } from "@/src/server/instance";
import { DEFAULTS, type RunConfig, type RunMode } from "@/src/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** dashboard bootstrap: known runs (live or from checkpoint) + key status */
export async function GET() {
  let runs = server.store.list();
  if (runs.length === 0) {
    // after a server restart the store is empty, but a checkpoint may exist
    const latest = server.checkpoints.latest();
    if (latest) runs = [latest];
  }
  return NextResponse.json({ runs, hasApiKey: hasApiKey() });
}

const clampInt = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === "number" ? Math.floor(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** start a batch — 202 immediately, the orchestrator runs in the background */
export async function POST(req: Request) {
  if (server.orchestrator.hasActiveRun()) {
    return NextResponse.json(
      { error: "Es läuft bereits ein Batch — erst stoppen oder abwarten." },
      { status: 409 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const mode: RunMode = body.mode === "anthropic" && hasApiKey() ? "anthropic" : "mock";
  const config: RunConfig = {
    mode,
    concurrency: clampInt(body.concurrency, 1, 8, DEFAULTS.concurrency),
    maxStepsPerAgent: DEFAULTS.maxStepsPerAgent,
    maxTokensPerAgent: DEFAULTS.maxTokensPerAgent,
    maxStrikes: DEFAULTS.maxStrikes,
    maxTokensPerCall: DEFAULTS.maxTokensPerCall,
    globalTokenBudget: clampInt(body.globalTokenBudget, 1_000, 2_000_000, DEFAULTS.globalTokenBudget),
    items: BATCH_ITEMS,
  };

  const { runId, done } = server.orchestrator.startRun(config);
  // fire-and-forget: this is a long-lived local Node process, not serverless.
  // execute() resolves even on fatal errors, the catch is belt-and-braces.
  void done.catch((err) => console.error(`run ${runId}:`, err));

  return NextResponse.json({ runId }, { status: 202 });
}
