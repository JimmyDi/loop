import { expect, test } from "vitest";

import { createBackendProxy } from "./backend-proxy";
import { createHttpServer, listen } from "../http/node-server";

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
    expect(new URL(received[0]!.url).pathname).toBe("/api/sessions/example/prompt");
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  }
});
