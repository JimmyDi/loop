import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { expect, test } from "vitest";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { AssistantMessage } from "@earendil-works/pi-ai";

import { createAgentSession, SessionManager, SettingsManager } from "@loop/coding-agent";
import { ProjectStore } from "../projects/project-store";
import { SessionRegistry } from "../session-registry";
import { createRouter } from "../router";
import { createLoopBridge } from "../loop";
import { ProviderSettings } from "../providers/provider-settings";
import type { ListFrame } from "../../shared/protocol";

test("HTTP permissions persist per session and an exact file write waits for a live human decision", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".permissions-http-"));
  const model = {
    id: "test",
    name: "Test",
    provider: "test",
    api: "openai-completions" as const,
    baseUrl: "https://example.invalid",
    reasoning: false,
    input: ["text" as const],
    contextWindow: 4096,
    maxTokens: 128,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  };
  const manager = await SessionManager.create(root, join(root, "history"));
  let calls = 0;
  const { session } = await createAgentSession({
    model,
    sessionManager: manager,
    settingsManager: SettingsManager.inMemory(),
    agentDir: join(root, "storage"),
    noContextFiles: true,
    modelRuntime: {
      getModel: () => model,
      getModels: () => [model],
      checkModel: async () => {},
      streamSimple: () => {
        const first = calls++ === 0;
        const message: AssistantMessage = {
          role: "assistant",
          api: model.api,
          provider: model.provider,
          model: model.id,
          timestamp: 0,
          stopReason: first ? "toolUse" : "stop",
          content: first
            ? [
                {
                  type: "toolCall",
                  id: "file-call",
                  name: "write",
                  arguments: { path: "result.txt", content: "approved content" },
                },
              ]
            : [{ type: "text", text: "done" }],
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
        };
        const stream = createAssistantMessageEventStream();
        stream.push({ type: "done", reason: first ? "toolUse" : "stop", message });
        return stream;
      },
    },
  });
  const projects = new ProjectStore(join(root, "projects.json"));
  const project = await projects.add(root, "Example");
  const registry = new SessionRegistry(projects, {
    load: async () => session,
    models: async () => [],
    list: async () => [],
    archive: async () => {},
    deleteSessions: async () => {},
    setModel: async () => {},
  });
  const controller = await registry.create(project.id);
  const route = createRouter(registry);
  const path = "/api/sessions/" + session.sessionId;
  const call = (suffix: string, method = "GET", body?: unknown, origin?: string) =>
    route(
      new Request("http://localhost" + path + suffix, {
        method,
        headers: { "Content-Type": "application/json", ...(origin ? { origin } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    expect((await call("/permission", "PUT", { preset: "invalid" })).status).toBe(400);
    expect(
      (await call("/permission", "PUT", { preset: "danger-full-access" }, "https://example.test"))
        .status,
    ).toBe(403);
    expect((await call("/permission", "PUT", { preset: "workspace-write" })).status).toBe(200);
    expect((await SessionManager.open(manager.sessionFile!)).getHeader().permissionPreset).toBe(
      "workspace-write",
    );
    expect((await call("/permission", "PUT", { preset: "read-only" })).status).toBe(200);
    reader = (await call("/events?approvals=1")).body!.getReader();
    await reader.read();
    expect(
      (
        await call("/prompt", "POST", {
          requestId: "prompt-request",
          text: "Write the example file",
        })
      ).status,
    ).toBe(202);
    for (let i = 0; i < 100 && !session.state.pendingApprovals?.length; i++) await sleep(5);
    const request = session.state.pendingApprovals![0]!;
    expect(request.operation).toMatchObject({
      kind: "file-write",
      targetPath: join(root, "result.txt"),
      arguments: { content: "approved content" },
    });
    expect(await existsSync(join(root, "result.txt"))).toBe(false);
    expect((await call("/permission", "PUT", { preset: "danger-full-access" })).status).toBe(409);
    const endpoint = "/approvals/" + request.requestId;
    expect((await call(endpoint, "POST", { decision: "always" })).status).toBe(400);
    expect(
      (await call(endpoint, "POST", { decision: "allowed-once" }, "https://example.test")).status,
    ).toBe(403);
    expect((await call("/approvals/unknown", "POST", { decision: "allowed-once" })).status).toBe(
      409,
    );
    expect((await call(endpoint, "POST", { decision: "allowed-once" })).status).toBe(200);
    expect((await call(endpoint, "POST", { decision: "allowed-once" })).status).toBe(409);
    await session.waitForIdle();
    expect(await readFile(join(root, "result.txt"), "utf8")).toBe("approved content");
    expect(session.permissionPreset).toBe("read-only");
    expect(controller.snapshot.lastApproval?.outcome).toBe("allowed-once");
  } finally {
    await reader?.cancel();
    await registry.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("HTTP unread headers survive restart and reject stale receipts across browsers", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".read-http-"));
  const projects = new ProjectStore(join(root, "projects.json"));
  const project = await projects.add(root, "Example");
  const model = {
    id: "example",
    provider: "example",
    name: "Example",
    api: "openai-completions" as const,
    baseUrl: "https://example.invalid",
    reasoning: false,
    input: ["text" as const],
    contextWindow: 4096,
    maxTokens: 128,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  };
  let modelCalls = 0;
  class Settings extends ProviderSettings {
    async runtime() {
      return {
        getModel: () => model,
        getModels: () => [model],
        checkModel: async () => {},
        streamSimple: () => {
          modelCalls++;
          const stream = createAssistantMessageEventStream();
          stream.push({
            type: "done",
            reason: "stop",
            message: {
              role: "assistant",
              content: [{ type: "text", text: "Example reply" }],
              api: model.api,
              provider: model.provider,
              model: model.id,
              stopReason: "stop",
              timestamp: 1,
              usage: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                totalTokens: 0,
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
              },
            },
          });
          return stream;
        },
      };
    }
    defaultModel() {
      return model;
    }
  }
  const makeRegistry = () =>
    new SessionRegistry(
      projects,
      createLoopBridge(root, new Settings(join(root, "provider.json"))),
    );
  let registry = makeRegistry();
  let route = createRouter(registry);
  const controller = await registry.create(project.id);
  const id = controller.session.sessionId;
  const read = (messageCount: unknown, sessionId = id, origin?: string) =>
    route(
      new Request("http://localhost/api/sessions/" + sessionId + "/read", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(origin ? { origin } : {}) },
        body: JSON.stringify({ workspaceId: project.id, messageCount }),
      }),
    );
  const list = async () =>
    (await route(new Request("http://localhost/api/sessions?workspaceId=" + project.id))).json();
  const run = async (requestId: string) => {
    const current = await registry.get(id);
    current.prompt(requestId, "Example request");
    for (let i = 0; i < 100 && current.busy; i++) await sleep(5);
    expect(current.busy).toBe(false);
    await current.session.cancelTitle();
    return current;
  };
  try {
    expect(controller.snapshot.state.unread).toBe(false);
    await run("first");
    expect((await list())[0]).toMatchObject({ unread: true, messageCount: 2 });
    const file = controller.session.sessionManager.sessionFile!;
    const original = await readFile(file, "utf8");
    const firstBrowser: ListFrame[] = [];
    const secondBrowser: ListFrame[] = [];
    registry.events.connect((frame) => firstBrowser.push(frame));
    registry.events.connect((frame) => secondBrowser.push(frame));
    expect((await read(2, id, "https://example.test")).status).toBe(403);
    expect((await read(2, "unknown")).status).toBe(404);
    for (const turn of [-1, 1.5, "2", null]) expect((await read(turn)).status).toBe(400);
    expect(await (await read(4)).json()).toEqual({ read: false });
    expect(firstBrowser).toHaveLength(1);
    const beforeRead = modelCalls;
    expect(await (await read(2)).json()).toEqual({ read: true });
    expect(modelCalls).toBe(beforeRead);
    expect(controller.snapshot.state.unread).toBe(false);
    const saved = await readFile(file, "utf8");
    expect(JSON.parse(saved.split("\n")[0]!)).toEqual({
      ...JSON.parse(original.split("\n")[0]!),
      unread: false,
    });
    expect(saved.split("\n").slice(1)).toEqual(original.split("\n").slice(1));
    expect(firstBrowser).toEqual(secondBrowser);
    expect(secondBrowser.at(-1)).toMatchObject({
      type: "sessions.changed",
      workspaceId: project.id,
    });
    await registry.archive(project.id, [id], true);
    expect((await registry.list(project.id))[0]).toMatchObject({ unread: false, archived: true });
    await registry.archive(project.id, [id], false);
    await registry.close();
    registry = makeRegistry();
    route = createRouter(registry);
    expect((await list())[0].unread).toBe(false);
    expect((await registry.get(id)).snapshot.state.unread).toBe(false);
    await run("second");
    expect(await (await read(2)).json()).toEqual({ read: false });
    expect((await list())[0]).toMatchObject({ unread: true, messageCount: 4 });
    expect((await SessionManager.open(file)).getHeader().unread).toBe(true);
    expect(await (await read(4)).json()).toEqual({ read: true });
    expect((await list())[0].unread).toBe(false);
  } finally {
    await registry.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("HTTP pins live in session headers, synchronize lists and survive restart without model calls", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".pin-http-"));
  const projects = new ProjectStore(join(root, "projects.json"));
  const project = await projects.add(root, "Example");
  const other = await projects.add(await mkdtemp(join(root, "other-")), "Other");
  const settings = new ProviderSettings(join(root, "provider.json"));
  await settings.upsert(
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
  const makeRegistry = () => new SessionRegistry(projects, createLoopBridge(root, settings));
  let registry = makeRegistry();
  let route = createRouter(registry);
  const first = await registry.create(project.id);
  const id = first.session.sessionId;
  const manager = first.session.sessionManager;
  await manager.commit([{ role: "user", content: "Example", timestamp: 1 }]);
  // Reopen the saved session through the real bridge, without a generation request.
  await registry.close();
  registry = makeRegistry();
  route = createRouter(registry);
  const pin = (
    pinned: unknown,
    workspaceId = project.id,
    sessionId = id,
    method = "PUT",
    origin?: string,
  ) =>
    route(
      new Request("http://localhost/api/sessions/" + sessionId + "/pin", {
        method,
        headers: { "Content-Type": "application/json", ...(origin ? { origin } : {}) },
        body: method === "GET" ? undefined : JSON.stringify({ workspaceId, pinned }),
      }),
    );
  const list = async (archived = false) =>
    (
      await route(
        new Request(
          "http://localhost/api/sessions?workspaceId=" +
            project.id +
            (archived ? "&archived=true" : ""),
        ),
      )
    ).json();
  try {
    const original = await readFile(manager.sessionFile!, "utf8");
    const firstBrowser: ListFrame[] = [];
    const secondBrowser: ListFrame[] = [];
    registry.events.connect((event) => firstBrowser.push(event));
    registry.events.connect((event) => secondBrowser.push(event));
    for (const invalid of [null, "true", 1, undefined])
      expect((await pin(invalid)).status).toBe(400);
    expect((await pin(true, project.id, id, "GET")).status).toBe(405);
    expect((await pin(true, project.id, id, "PUT", "https://example.test")).status).toBe(403);
    expect((await pin(true, other.id)).status).toBe(404);
    expect((await pin(true, project.id, "missing")).status).toBe(404);
    const response = await pin(true);
    expect(response.status).toBe(200);
    const { pinnedAt } = await response.json();
    expect(pinnedAt).toBe(new Date(pinnedAt).toISOString());
    expect(await (await pin(true)).json()).toEqual({ pinnedAt });
    expect((await list())[0]).toMatchObject({ id, pinnedAt });
    const saved = await readFile(manager.sessionFile!, "utf8");
    expect(JSON.parse(saved.split("\n")[0]!)).toEqual({
      ...JSON.parse(original.split("\n")[0]!),
      pinnedAt,
    });
    expect(saved.split("\n").slice(1)).toEqual(original.split("\n").slice(1));
    expect(firstBrowser).toEqual(secondBrowser);
    expect(secondBrowser.at(-1)).toMatchObject({
      type: "sessions.changed",
      workspaceId: project.id,
    });
    const controller = await registry.get(id);
    // Pin metadata is independent of an active generation operation.
    controller.snapshot.operation = "prompt";
    expect((await pin(false)).status).toBe(200);
    expect(controller.snapshot.operation).toBe("prompt");
    expect((await list())[0].pinnedAt).toBeUndefined();
    controller.snapshot.operation = "idle";
    const repinned = await (await pin(true)).json();
    await registry.archive(project.id, [id], true);
    expect(await list()).toEqual([]);
    expect((await list(true))[0].pinnedAt).toBe(repinned.pinnedAt);
    await registry.archive(project.id, [id], false);
    await registry.close();
    registry = makeRegistry();
    route = createRouter(registry);
    expect((await list())[0].pinnedAt).toBe(repinned.pinnedAt);
    expect(await (await pin(false)).json()).toEqual({ pinnedAt: null });
    expect((await SessionManager.open(manager.sessionFile!)).getHeader().pinnedAt).toBeUndefined();
    await pin(true);
    await registry.archive(project.id, [id], "delete-session");
    expect(await list()).toEqual([]);
    expect(await existsSync(manager.sessionFile!)).toBe(false);
  } finally {
    await registry.close();
    await rm(root, { recursive: true, force: true });
  }
});
