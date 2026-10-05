import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { AssistantMessage } from "@earendil-works/pi-ai";

import { createAgentSession, SessionManager, SettingsManager } from "../../../coding-agent/index";
import { ProjectStore } from "../projects/project-store";
import { SessionRegistry } from "../session-registry";
import { createRouter } from "../router";

test("HTTP permissions persist per session and an exact file write waits for a live human decision", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".permissions-http-"));
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
    for (let i = 0; i < 100 && !session.state.pendingApprovals?.length; i++) await Bun.sleep(5);
    const request = session.state.pendingApprovals![0]!;
    expect(request.operation).toMatchObject({
      kind: "file-write",
      targetPath: join(root, "result.txt"),
      arguments: { content: "approved content" },
    });
    expect(await Bun.file(join(root, "result.txt")).exists()).toBe(false);
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
    expect(await Bun.file(join(root, "result.txt")).text()).toBe("approved content");
    expect(session.permissionPreset).toBe("read-only");
    expect(controller.snapshot.lastApproval?.outcome).toBe("allowed-once");
  } finally {
    await reader?.cancel();
    await registry.close();
    await rm(root, { recursive: true, force: true });
  }
});
