import { expect, test, vi } from "vitest";

import { createBackendProxy } from "./backend-proxy";
import { createHttpServer, listen } from "../http/node-server";
import { readContext } from "../http/business-context";

test.each(["text/event-stream", "application/json"])(
  "worker shutdown closes SSE but rejects incomplete data responses (%s)",
  async (contentType) => {
    const upstream = createHttpServer(
      () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode("partial"));
            },
          }),
          { headers: { "Content-Type": contentType } },
        ),
    );
    const address = await listen(upstream, 0);
    let target: { port: number; token: string } | undefined = {
      port: Number(address.port),
      token: "synthetic",
    };
    const proxy = createBackendProxy(() => target);
    const response = await proxy(new Request("http://localhost/api/events"));
    const reader = response.body!.getReader();
    try {
      expect(new TextDecoder().decode((await reader.read()).value)).toBe("partial");
      target = undefined;
      upstream.closeAllConnections();
      if (contentType === "text/event-stream") {
        expect((await reader.read()).done).toBe(true);
      } else {
        await expect(reader.read()).rejects.toThrow();
      }
    } finally {
      await reader.cancel().catch(() => {});
      await new Promise<void>((resolve) => {
        upstream.close(() => resolve());
        upstream.closeAllConnections();
      });
    }
  },
);

test("proxy preserves upstream stream failures while the browser is connected", async () => {
  const failure = new Error("Synthetic upstream failure");
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(failure);
            },
          }),
          { headers: { "Content-Type": "text/event-stream" } },
        ),
    ),
  );
  try {
    const proxy = createBackendProxy(() => ({ port: 1, token: "synthetic" }));
    const response = await proxy(new Request("http://localhost/api/events"));
    await expect(response.text()).rejects.toBe(failure);
  } finally {
    vi.unstubAllGlobals();
  }
});

test("closing a proxied event stream cancels upstream without logging a server error", async () => {
  let disconnected = false;
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const upstream = createHttpServer((request) => {
    if (new URL(request.url).pathname === "/api/status") return Response.json({ ready: true });
    request.signal.addEventListener("abort", () => {
      disconnected = true;
    });
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("data: ready\n\n"));
        },
      }),
      { headers: { "Content-Type": "text/event-stream" } },
    );
  });
  const address = await listen(upstream, 0);
  const gateway = createHttpServer(
    createBackendProxy(() => ({ port: Number(address.port), token: "synthetic" })),
  );
  const url = await listen(gateway, 0);
  const abort = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch(url, { signal: abort.signal });
    reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toBe("data: ready\n\n");
    abort.abort();
    await reader.cancel().catch(() => {});
    await vi.waitFor(() => expect(disconnected).toBe(true));
    expect(errors).not.toHaveBeenCalled();
    expect(await (await fetch(new URL("/api/status", url))).json()).toEqual({ ready: true });
  } finally {
    abort.abort();
    await reader?.cancel().catch(() => {});
    for (const server of [gateway, upstream]) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
    }
    errors.mockRestore();
  }
});

test("proxy streams requests and responses without forwarding browser credentials", async () => {
  const received: Request[] = [];
  const server = createHttpServer(async (request) => {
    received.push(request);
    return new Response(await request.text(), { headers: { "Content-Type": "text/event-stream" } });
  });
  const address = await listen(server, 0);
  const proxy = createBackendProxy(() => ({ port: Number(address.port), token: "synthetic" }));
  try {
    const response = await proxy(
      new Request("https://example.test/api/sessions/example/prompt?q=1", {
        method: "POST",
        headers: { cookie: "example=synthetic", authorization: "untrusted" },
        body: "Synthetic request",
      }),
    );
    expect(await response.text()).toBe("Synthetic request");
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(received).toHaveLength(1);
    expect(received[0]!.headers.get("cookie")).toBeNull();
    expect(received[0]!.headers.get("authorization")).toBe("Bearer synthetic");
    expect(readContext(received[0]!.headers)).toEqual({
      principal: "local",
      remote: false,
      origin: "https://example.test",
    });
    expect(new URL(received[0]!.url).pathname).toBe("/api/sessions/example/prompt");
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  }
});
