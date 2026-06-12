import { NextResponse } from "next/server";
import { server } from "@/src/server/instance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** manual kill switch: stops scheduling AND aborts in-flight LLM calls */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const killed = server.orchestrator.kill(id);
  if (!killed) {
    return NextResponse.json({ error: "Kein aktiver Run mit dieser ID." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
