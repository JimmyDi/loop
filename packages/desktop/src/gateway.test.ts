import { createServer } from "node:http";
import { once } from "node:events";
import { expect, test, vi } from "vitest";

import { createGateway } from "./gateway";

test("desktop gateway authenticates requests, rewrites origin and protects update commands", async () => {
  const backend = createServer((request, response) =>
    response.end(JSON.stringify(request.headers)),
  );
  backend.listen(0, "127.0.0.1");
  await once(backend, "listening");
  const backendUrl = "http://127.0.0.1:" + (backend.address() as { port: number }).port;
  const action = vi.fn();
  const gateway = await createGateway({
    backend: backendUrl,
    token: "synthetic-test-token",
    port: 0,
    assets: ".",
    state: () => ({ phase: "idle" }),
    action,
  });
  const url = "http://127.0.0.1:" + (gateway.address() as { port: number }).port;
  try {
    expect((await fetch(url)).status).toBe(401);
    const login = await fetch(url + "/__desktop/bootstrap?token=synthetic-test-token", {
      redirect: "manual",
    });
    expect(login.status).toBe(303);
    const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
    const headers = { cookie, origin: url };
    expect((await fetch(url + "//example.test/", { headers })).status).toBe(403);
    const proxied = await (await fetch(url + "/api/workspaces", { headers })).json();
    expect(proxied.origin).toBe(backendUrl);
    expect(proxied.cookie).toBeUndefined();
    expect(
      (
        await fetch(url + "/__desktop/stop", {
          method: "POST",
          headers: { ...headers, origin: "https://example.test" },
        })
      ).status,
    ).toBe(403);
    expect(action).not.toHaveBeenCalled();
    expect((await fetch(url + "/__desktop/check", { method: "POST", headers })).status).toBe(404);
    expect(action).not.toHaveBeenCalled();
    expect((await fetch(url + "/__desktop/stop", { method: "POST", headers })).status).toBe(202);
    expect(action).toHaveBeenCalledWith("stop");
  } finally {
    gateway.closeAllConnections();
    backend.closeAllConnections();
    await Promise.all([
      new Promise<void>((resolve) => gateway.close(() => resolve())),
      new Promise<void>((resolve) => backend.close(() => resolve())),
    ]);
  }
});
