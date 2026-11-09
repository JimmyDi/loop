import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, vi } from "vitest";

import { startDevelopmentBackend } from "./development-backend";

test("worker restarts preserve user data isolation behind the trusted proxy", async () => {
  const directory = await mkdtemp(join(import.meta.dirname, ".worker-test-"));
  vi.stubEnv("LOOP_DATA_DIR", directory);
  const backend = startDevelopmentBackend();
  const request = () => new Request("http://localhost/api/workspaces");
  const first = {
    userId: "00000000-0000-4000-8000-000000000001",
    principal: "a".repeat(64),
    remote: false,
    expiresAt: Date.now() + 60_000,
  };
  const second = {
    ...first,
    userId: "00000000-0000-4000-8000-000000000002",
    principal: "b".repeat(64),
  };
  try {
    expect((await backend.handle(request(), first)).status).toBe(503);
    await vi.waitFor(() => expect(backend.ready()).toBe(true), { timeout: 15_000 });
    expect((await backend.handle(request())).status).toBe(401);
    const created = await backend.handle(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: directory }),
      }),
      first,
    );
    expect(created.status).toBe(200);
    expect(await (await backend.handle(request(), second)).json()).toEqual([]);
    expect(await (await backend.handle(request(), first)).json()).toHaveLength(1);
    backend.restart();
    await vi.waitFor(() => expect(backend.ready()).toBe(false));
    expect((await backend.handle(request(), first)).status).toBe(503);
    await vi.waitFor(() => expect(backend.ready()).toBe(true), { timeout: 15_000 });
    expect(await (await backend.handle(request(), first)).json()).toHaveLength(1);
    expect(await (await backend.handle(request(), second)).json()).toEqual([]);
    await backend.revokeVoice(first.principal);
    expect(
      (
        await backend.handle(
          new Request("http://localhost/api/voice/calls", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ clientId: crypto.randomUUID(), mode: "test" }),
          }),
          first,
        )
      ).status,
    ).toBe(401);
  } finally {
    await backend.close();
    vi.unstubAllEnvs();
    await rm(directory, { recursive: true, force: true });
  }
});
