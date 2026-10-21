import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { AgentSession, SessionManager } from "@loop/coding-agent";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { expect, test } from "vitest";

import { createBusinessRouter } from "../business-router";
import { ProjectStore } from "../projects/project-store";
import { SessionRegistry } from "../session-registry";
import { createRemoteHandler } from "./remote-ingress";
import { RemoteDevices } from "./remote-devices";
import { DeviceStore } from "./device-store";
import { deviceCookie } from "./device-credentials";

const model = {
  id: "test",
  name: "Test",
  provider: "test",
  api: "openai-completions" as const,
  baseUrl: "https://example.test",
  reasoning: false,
  input: ["text" as const],
  contextWindow: 4096,
  maxTokens: 128,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
};

test("paired device uses the existing session HTTP and SSE contracts without real model calls", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".remote-business-"));
  const projects = new ProjectStore(join(root, "projects.json"));
  const project = await projects.add(root, "Example");
  const session = new AgentSession({
    model,
    sessionManager: SessionManager.inMemory(),
    systemPrompt: "Synthetic fixture",
    tools: [],
    modelRuntime: {
      getModel: () => model,
      getModels: () => [model],
      checkModel: async () => {},
      streamSimple: () => {
        const native = createAssistantMessageEventStream();
        native.push({
          type: "done",
          reason: "stop",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Synthetic answer" }],
            api: model.api,
            provider: model.provider,
            model: model.id,
            stopReason: "stop",
            timestamp: 0,
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
        return native;
      },
    },
  });
  const registry = new SessionRegistry(projects, {
    models: async () => [{ id: model.id, provider: model.provider, name: model.name }],
    list: async () => [],
    archive: async () => {},
    deleteSessions: async () => {},
    load: async () => session,
    setModel: async () => {},
  });
  const devices = new RemoteDevices(new DeviceStore(join(root, "devices.json")));
  const origin = "https://example.test";
  const requestAbort = new AbortController();
  try {
    await devices.load();
    devices.connect(origin);
    const pairing = devices.pairing.request(
      origin,
      new URL(devices.invite().url).hash.slice(6),
      "Phone",
    );
    await devices.decide(pairing.pending.id, true);
    const headers = {
      origin,
      cookie: deviceCookie + "=" + pairing.credential,
      "Content-Type": "application/json",
      "X-Loop-CSRF": devices.csrf(pairing.credential),
    };
    const handle = createRemoteHandler(devices, createBusinessRouter(registry), root, () => "");
    const call = (path: string, method = "GET", body?: unknown) =>
      handle(
        new Request(origin + "/api" + path, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: requestAbort.signal,
        }),
      );
    expect((await (await call("/workspaces")).json())[0].id).toBe(project.id);
    const created = await call("/sessions", "POST", { workspaceId: project.id });
    expect(created.status).toBe(201);
    const snapshot = await created.json();
    const events = await call("/sessions/" + snapshot.sessionId + "/events");
    const reader = events.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain("session.snapshot");
    const prompt = await call("/sessions/" + snapshot.sessionId + "/prompt", "POST", {
      requestId: "synthetic-request",
      text: "Example prompt",
    });
    expect(prompt.status).toBe(202);
    await session.waitForIdle();
    const completed = await (await call("/sessions/" + snapshot.sessionId)).json();
    expect(completed.state.messages.at(-1).content).toEqual([
      { type: "text", text: "Synthetic answer" },
    ]);
    const read = reader.read();
    devices.connect();
    await read;
    await reader.cancel();
    expect((await call("/sessions/" + snapshot.sessionId)).status).toBe(503);
  } finally {
    requestAbort.abort();
    devices.connect();
    await registry.close();
    await rm(root, { recursive: true, force: true });
  }
});
