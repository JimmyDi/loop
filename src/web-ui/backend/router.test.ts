import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
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
      archive: async () => {},
      deleteSessions: async () => {},
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

test("archiving preserves history, filters lists, restores and survives registration changes", async () => {
  const { SessionManager, getSessionDir } = await import("../../coding-agent/index");
  const { createLoopBridge } = await import("./loop");
  const root = await mkdtemp(join(import.meta.dir, ".archive-http-test-"));
  try {
    const projects = new ProjectStore(join(root, "projects.json"));
    const project = await projects.add(root, "Example");
    const session = await SessionManager.create(root, getSessionDir(root, root));
    const id = session.getSessionId();
    await session.commit([{ role: "user", content: "Example request", timestamp: 1 }]);
    const history = await Bun.file(session.sessionFile!).text();
    const registry = new SessionRegistry(projects, createLoopBridge(root));
    const route = createRouter(registry);
    const call = (path: string, method = "GET", body?: unknown) =>
      route(
        new Request("http://localhost/api" + path, {
          method,
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        }),
      );
    const endpoint = "/workspaces/" + project.id + "/archive";
    expect((await call(endpoint, "POST", { ids: [id], archived: "yes" })).status).toBe(400);
    expect(
      (await call(endpoint, "POST", { ids: [id, crypto.randomUUID()], archived: true })).status,
    ).toBe(404);
    expect((await (await call("/sessions?workspaceId=" + project.id)).json()).length).toBe(1);
    expect((await call(endpoint, "POST", { ids: [id], archived: true })).status).toBe(204);
    expect(await (await call("/sessions?workspaceId=" + project.id)).json()).toEqual([]);
    expect(
      (await (await call("/sessions?workspaceId=" + project.id + "&archived=true")).json())[0].id,
    ).toBe(id);
    expect(await Bun.file(session.sessionFile!).text()).toBe(history);
    await registry.close();
    const restarted = new SessionRegistry(projects, createLoopBridge(root));
    expect((await restarted.list(project.id))[0]?.archived).toBe(true);
    await restarted.remove(project.id);
    const added = await projects.add(root, "Example");
    expect(added.id).not.toBe(project.id);
    expect((await restarted.list(added.id))[0]?.archived).toBe(true);
    await restarted.archive(added.id, [id], false);
    expect((await restarted.list(added.id))[0]?.archived).toBe(false);
    expect(await Bun.file(session.sessionFile!).text()).toBe(history);
    await restarted.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("archive DELETE validates selection and never deletes unarchived chats", async () => {
  const { SessionManager, getSessionDir } = await import("../../coding-agent/index");
  const { createLoopBridge } = await import("./loop");
  const root = await mkdtemp(join(import.meta.dir, ".archive-delete-http-"));
  try {
    const projects = new ProjectStore(join(root, "projects.json"));
    const project = await projects.add(root, "Example");
    const session = await SessionManager.create(root, getSessionDir(root, root));
    const id = session.getSessionId();
    const registry = new SessionRegistry(projects, createLoopBridge(root));
    const route = createRouter(registry);
    const remove = (body: unknown) =>
      route(
        new Request("http://localhost/api/workspaces/" + project.id + "/archive", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    expect((await remove({ ids: "all" })).status).toBe(400);
    expect((await remove({ ids: [id] })).status).toBe(409);
    await registry.archive(project.id, [id], true);
    expect((await remove({ ids: [id, "invalid"] })).status).toBe(409);
    expect(await Bun.file(session.sessionFile!).exists()).toBe(true);
    expect((await remove({ ids: [id] })).status).toBe(204);
    expect(await Bun.file(session.sessionFile!).exists()).toBe(false);
    expect(await registry.list(project.id)).toEqual([]);
    await registry.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("session DELETE permanently removes only the selected project's chat without archiving first", async () => {
  const { SessionManager, getSessionDir } = await import("../../coding-agent/index");
  const { createLoopBridge } = await import("./loop");
  const root = await mkdtemp(join(import.meta.dir, ".session-delete-http-"));
  try {
    const projects = new ProjectStore(join(root, "projects.json"));
    const project = await projects.add(root, "Example");
    const session = await SessionManager.create(root, getSessionDir(root, root));
    const kept = await SessionManager.create(root, getSessionDir(root, root));
    await mkdir(join(root, "other"));
    const foreign = await SessionManager.create(
      join(root, "other"),
      getSessionDir(join(root, "other"), root),
    );
    const id = session.getSessionId();
    const registry = new SessionRegistry(projects, createLoopBridge(root));
    const route = createRouter(registry);
    const remove = (id: string) =>
      route(
        new Request("http://localhost/api/workspaces/" + project.id + "/sessions/" + id, {
          method: "DELETE",
        }),
      );
    expect((await remove(foreign.getSessionId())).status).toBe(404);
    expect((await remove("unknown")).status).toBe(404);
    expect(await Bun.file(session.sessionFile!).exists()).toBe(true);
    expect((await remove(id)).status).toBe(204);
    expect(await Bun.file(session.sessionFile!).exists()).toBe(false);
    expect(await Bun.file(kept.sessionFile!).exists()).toBe(true);
    expect(await Bun.file(foreign.sessionFile!).exists()).toBe(true);
    expect((await remove(id)).status).toBe(404);
    await registry.archive(project.id, [kept.getSessionId()], true);
    expect((await remove(kept.getSessionId())).status).toBe(204);
    expect(await registry.list(project.id)).toEqual([]);
    await registry.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
