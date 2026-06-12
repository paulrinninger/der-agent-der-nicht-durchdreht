import { server } from "@/src/server/instance";
import type { RunEvent } from "@/src/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * SSE stream: full snapshot on (re)connect, then live tail. The EventSource
 * client can therefore reconnect blindly — no Last-Event-ID bookkeeping.
 * Cleanup hangs off req.signal so page refreshes don't leak subscribers.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const run = server.store.get(id);
  if (!run) return new Response("Run nicht gefunden", { status: 404 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true; // enqueue throws after disconnect
        }
      };
      const send = (event: RunEvent) => write(`data: ${JSON.stringify(event)}\n\n`);

      send({ type: "snapshot", run: server.store.get(id)! });
      const unsubscribe = server.store.subscribe(id, send);
      const ping = setInterval(() => write(": ping\n\n"), 15_000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
