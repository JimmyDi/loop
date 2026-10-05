import { once } from "node:events";
import { setTimeout as sleep } from "node:timers/promises";
import { expect, test } from "vitest";

import { createHttpServer, listen } from "./node-server";

test("Node adapter forwards JSON, streams SSE before completion and cancels on disconnect", async () => {
  let cancelled = false;
  const server = createHttpServer(async (request) => {
    if (request.method === "POST") return Response.json(await request.json());
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("data: ready\n\n"));
        },
        cancel() {
          cancelled = true;
        },
      }),
      { headers: { "Content-Type": "text/event-stream" } },
    );
  });
  const url = await listen(server, 0);
  try {
    const posted = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: 1 }),
    });
    expect(await posted.json()).toEqual({ value: 1 });
    const abort = new AbortController();
    const response = await fetch(url, { signal: abort.signal });
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toBe("data: ready\n\n");
    abort.abort();
    await reader.cancel().catch(() => {});
    for (let i = 0; i < 100 && !cancelled; i++) await sleep(5);
    expect(cancelled).toBe(true);
  } finally {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  }
});
