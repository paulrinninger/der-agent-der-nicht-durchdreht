import { NextResponse, after } from "next/server";
import { server } from "@/src/server/instance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Resume a stopped run: completed/failed agents are carried over (not paid
 * twice), aborted/pending ones run again. Works from memory or — after a
 * server restart — from the checkpoint file.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (server.orchestrator.hasActiveRun()) {
    return NextResponse.json({ error: "Es läuft bereits ein Batch." }, { status: 409 });
  }

  const previous = server.store.get(id) ?? server.checkpoints.load(id);
  if (!previous) {
    return NextResponse.json({ error: "Run nicht gefunden." }, { status: 404 });
  }
  if (previous.status === "running") {
    return NextResponse.json({ error: "Run läuft noch." }, { status: 409 });
  }

  const { runId, done } = server.orchestrator.resumeRun(previous);
  // s. runs/route.ts: hält Serverless-Instanzen bis zum Batch-Ende am Leben
  after(() => done.catch((err) => console.error(`resume ${runId}:`, err)));
  return NextResponse.json({ runId }, { status: 202 });
}
