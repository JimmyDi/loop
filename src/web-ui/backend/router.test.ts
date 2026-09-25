import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";

import { ProjectStore } from "./projects/project-store";
import { SessionRegistry } from "./session-registry";
import { createRouter } from "./router";

test("project HTTP lifecycle stays local and never accepts a session file path", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".router-test-"));

  try {
    const registry = new SessionRegistry(new ProjectStore(join(root, "projects.json")), {
      models: async () => [{ id: "test", provider: "test", name: "Test" }],
      list: async () => [],
      load: async () => {
        throw new Error("Unexpected load");
      },
      setModel: async () => {},
    });
    const route = createRouter(registry);
    const call = (path: string, method = "GET", body?: unknown) =>
      route(
        new Request("http://localhost" + path, {
          method,
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        }),
      );
    const created = await call("/api/workspaces", "POST", { path: root });
    const project = await created.json();

    expect(created.status).toBe(200);
    expect((await (await call("/api/workspaces")).json()).length).toBe(1);
    expect((await call("/api/sessions", "POST", { path: "/private/session.jsonl" })).status).toBe(
      400,
    );
    expect((await call("/api/workspaces/" + project.id, "PATCH", { name: "Renamed" })).status).toBe(
      200,
    );
    expect((await call("/api/workspaces/" + project.id, "DELETE")).status).toBe(204);
    expect(
      (
        await route(
          new Request("http://localhost/api/models", {
            headers: { origin: "https://example.test" },
          }),
        )
      ).status,
    ).toBe(403);
    await registry.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
