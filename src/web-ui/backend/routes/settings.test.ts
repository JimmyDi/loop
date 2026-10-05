import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";

import { SessionManager, getSessionDir } from "../../../coding-agent/index";
import type { AgentSession } from "../../../coding-agent/index";
import { createLoopBridge } from "../loop";
import { ProviderSettings } from "../providers/provider-settings";
import { ProjectStore } from "../projects/project-store";
import { SessionRegistry } from "../session-registry";
import { createRouter } from "../router";
import { WebSettings } from "../settings/web-settings";

test("General permission API changes only future Web sessions across projects and restarts", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".default-permission-test-"));
  const providers = new ProviderSettings(join(root, "web-ui", "provider.json"));
  const settings = new WebSettings(root);
  const registry = new SessionRegistry(
    new ProjectStore(join(root, "projects.json")),
    createLoopBridge(root, providers, settings),
  );
  const router = createRouter(registry, providers, settings);
  const call = (path: string, method = "GET", body?: unknown, origin?: string) =>
    router(
      new Request("http://localhost/api" + path, {
        method,
        headers: { "Content-Type": "application/json", ...(origin ? { origin } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  try {
    await providers.upsert(
      {
        id: "example",
        kind: "custom",
        name: "Example",
        api: "openai-completions",
        baseUrl: "https://example.invalid/v1",
        authentication: "none",
        models: [{ id: "example" }],
      },
      true,
    );
    const project = await registry.projects.add(root, "Example");
    await mkdir(join(root, "other"));
    const other = await registry.projects.add(join(root, "other"), "Other");
    expect(await (await call("/settings/general")).json()).toEqual({
      permissionPreset: "read-only",
    });
    const existing = await registry.create(project.id);
    for (const body of [
      {},
      { permissionPreset: "full" },
      { permissionPreset: true },
      { permissionPreset: "read-only", extra: true },
    ])
      expect((await call("/settings/general", "PUT", body)).status).toBe(400);
    expect((await call("/settings/general", "POST", {})).status).toBe(405);
    expect(
      (
        await call(
          "/settings/general",
          "PUT",
          { permissionPreset: "danger-full-access" },
          "https://example.test",
        )
      ).status,
    ).toBe(403);
    expect(
      (await call("/settings/general", "PUT", { permissionPreset: "workspace-write" })).status,
    ).toBe(200);
    expect(existing.snapshot.state.permissionPreset).toBe("read-only");
    const created = await call("/sessions", "POST", { workspaceId: project.id });
    expect(created.status).toBe(201);
    const next = await created.json();
    expect(next.state.permissionPreset).toBe("workspace-write");
    const controller = await registry.get(next.sessionId);
    const manager = (controller.session as AgentSession).sessionManager;
    expect(await SessionManager.list(root, getSessionDir(root, root))).toEqual([]);
    await manager.commit([{ role: "user", content: "Synthetic saved session", timestamp: 1 }]);
    expect(
      (await call("/settings/general", "PUT", { permissionPreset: "danger-full-access" })).status,
    ).toBe(200);
    expect(controller.snapshot.state.permissionPreset).toBe("workspace-write");
    expect((await registry.create(other.id)).snapshot.state.permissionPreset).toBe(
      "danger-full-access",
    );
    await registry.close();
    const fresh = createLoopBridge(
      root,
      new ProviderSettings(join(root, "web-ui", "provider.json")),
    );
    const restored = await fresh.load(project, next.sessionId);
    const newSession = await fresh.load(project);
    expect(restored.state.permissionPreset).toBe("workspace-write");
    expect(newSession.state.permissionPreset).toBe("danger-full-access");
    restored.dispose();
    newSession.dispose();
    const legacy = await SessionManager.create(root, getSessionDir(root, root));
    await legacy.setModel({ provider: "example", id: "example" });
    const oldSession = await fresh.load(project, legacy.getSessionId());
    expect(oldSession.state.permissionPreset).toBe("read-only");
    oldSession.dispose();
    await Bun.write(join(root, "web-ui", "settings.json"), "invalid");
    await expect(fresh.load(project)).rejects.toThrow();
    const unaffected = await fresh.load(project, next.sessionId);
    expect(unaffected.state.permissionPreset).toBe("workspace-write");
    unaffected.dispose();
  } finally {
    await registry.close();
    await rm(root, { recursive: true, force: true });
  }
});
