import type { Cursor } from "../../shared/protocol";
import type { SessionEvents } from "../session-events";

export const eventResponse = (events: SessionEvents, request: Request): Response => {
  const url = new URL(request.url);
  const raw = request.headers.get("last-event-id") ?? url.searchParams.get("cursor");
  let cursor: Cursor | undefined;

  if (raw) {
    const [streamId, seq] = raw.split(":");

    if (streamId && /^\d+$/.test(seq ?? "")) cursor = { streamId, seq: Number(seq) };
  }

  const encoder = new TextEncoder();
  let stop = (_cancelled = false) => {};
  const body = new ReadableStream<Uint8Array>(
    {
      start(controller) {
        let closed = false;
        let unsubscribe = () => {};
        let heartbeat: ReturnType<typeof setInterval> | undefined;
        const close = (cancelled = false) => {
          if (closed) return;

          closed = true;
          unsubscribe();
          clearInterval(heartbeat);
          request.signal.removeEventListener("abort", abort);

          if (!cancelled) controller.close();
        };
        const abort = () => close();
        const send = (text: string) => {
          if (closed) return;

          if ((controller.desiredSize ?? 0) <= 0) return close();

          controller.enqueue(encoder.encode(text));
        };

        unsubscribe = events.connect(
          (frame) => send(`id: ${frame.streamId}:${frame.seq}\ndata: ${JSON.stringify(frame)}\n\n`),
          cursor,
          close,
        );

        if (closed) unsubscribe();
        else heartbeat = setInterval(() => send(": heartbeat\n\n"), 15000);

        stop = close;
        request.signal.addEventListener("abort", abort, { once: true });

        if (request.signal.aborted) close();
      },
      cancel() {
        stop(true);
      },
    },
    { highWaterMark: 1024 * 1024, size: (chunk) => chunk?.byteLength ?? 0 },
  );

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
};
