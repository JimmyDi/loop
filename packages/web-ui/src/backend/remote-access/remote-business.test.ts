import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { AgentSession, SessionManager } from "@loop/coding-agent";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { expect, test, vi } from "vitest";

import type { Frame, SessionSnapshot } from "../../shared/protocol";
import { applyFrame } from "../../shared/session-projection";
import { createBusinessRouter } from "../business-router";
import { ProjectStore } from "../projects/project-store";
import { SessionRegistry } from "../session-registry";
import { startRemoteIngress } from "./remote-ingress";
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

const answer = (text: string) => ({
  role: "assistant" as const,
  content: [{ type: "text" as const, text }],
  api: model.api,
  provider: model.provider,
  model: model.id,
  stopReason: "stop" as const,
  timestamp: 0,
  usage: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
});

test("paired phone receives successive model deltas over HTTP before completion and resumes live after reconnect", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".remote-business-"));
  const projects = new ProjectStore(join(root, "projects.json"));
  const project = await projects.add(root, "Example");
  const native = createAssistantMessageEventStream();
  const streamSimple = vi.fn(() => native);
  const session = new AgentSession({
    model,
    sessionManager: SessionManager.inMemory(),
    systemPrompt: "Synthetic fixture",
    tools: [],
    modelRuntime: {
      getModel: () => model,
      getModels: () => [model],
      checkModel: async () => {},
      streamSimple,
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
  const ingress = await startRemoteIngress(devices, createBusinessRouter(registry), root);
  try {
    await devices.load();
    ingress.connected(origin);
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
    const call = (path: string, method = "GET", body?: unknown) =>
      fetch("http://127.0.0.1:" + ingress.port + "/api" + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.any([requestAbort.signal, AbortSignal.timeout(5000)]),
      });
    expect((await (await call("/workspaces")).json())[0].id).toBe(project.id);
    const created = await call("/sessions", "POST", { workspaceId: project.id });
    expect(created.status).toBe(201);
    const snapshot = await created.json();
    const events = await call("/sessions/" + snapshot.sessionId + "/events");
    expect(events.headers.get("cache-control")?.split(/,\s*/)).toEqual(
      expect.arrayContaining(["no-store", "no-transform"]),
    );
    expect(events.headers.get("x-accel-buffering")).toBe("no");
    let reader = events.body!.getReader();
    let phone: SessionSnapshot | undefined;
    let cursor = "";
    let buffered = "";
    const decoder = new TextDecoder();
    const until = async (matches: (frame: Frame) => boolean) => {
      while (true) {
        const boundary = buffered.indexOf("\n\n");
        if (boundary < 0) {
          const chunk = await reader.read();
          if (chunk.done) throw new Error("SSE closed before expected event");
          buffered += decoder.decode(chunk.value, { stream: true });
          continue;
        }
        const packet = buffered.slice(0, boundary);
        buffered = buffered.slice(boundary + 2);
        const data = packet.split("\n").find((line) => line.startsWith("data: "));
        if (!data) continue;
        const frame = JSON.parse(data.slice(6)) as Frame;
        phone = applyFrame(phone, frame);
        cursor = frame.streamId + ":" + frame.seq;
        if (matches(frame)) return frame;
      }
    };
    await until((frame) => frame.type === "session.snapshot");
    const prompt = await call("/sessions/" + snapshot.sessionId + "/prompt", "POST", {
      requestId: "synthetic-request",
      text: "Example prompt",
    });
    expect(prompt.status).toBe(202);
    await vi.waitFor(() => expect(streamSimple).toHaveBeenCalled());
    native.push({ type: "start", partial: answer("") });
    const update = async (delta: string, text: string) => {
      native.push({ type: "text_delta", contentIndex: 0, delta, partial: answer(text) });
      await until((frame) => frame.type === "loop.event" && frame.event.type === "message_update");
      expect(phone?.state.draft?.content).toEqual([{ type: "text", text }]);
      expect(phone?.operation).toBe("prompt");
      expect(session.state.isRunning).toBe(true);
      expect(phone?.state.messages.some((message) => message.role === "assistant")).toBe(false);
    };
    await update("Synthetic", "Synthetic");
    await update(" answer", "Synthetic answer");
    await reader.cancel();
    const resumed = await call(
      "/sessions/" + snapshot.sessionId + "/events?cursor=" + encodeURIComponent(cursor),
    );
    reader.releaseLock();
    reader = resumed.body!.getReader();
    buffered = "";
    await until((frame) => frame.type === "session.snapshot");
    expect(phone?.state.draft?.content).toEqual([{ type: "text", text: "Synthetic answer" }]);
    await update(" continues", "Synthetic answer continues");
    native.push({ type: "done", reason: "stop", message: answer("Synthetic answer continues") });
    await until((frame) => frame.type === "session.state" && frame.snapshot.operation === "idle");
    expect(phone?.state.draft).toBeUndefined();
    expect(phone?.state.messages.at(-1)?.content).toEqual([
      { type: "text", text: "Synthetic answer continues" },
    ]);
    await session.waitForIdle();
    const completed = await (await call("/sessions/" + snapshot.sessionId)).json();
    expect(completed.state.messages.at(-1).content).toEqual([
      { type: "text", text: "Synthetic answer continues" },
    ]);
    const read = reader.read();
    devices.connect();
    await read;
    await reader.cancel();
    expect((await call("/sessions/" + snapshot.sessionId)).status).toBe(503);
  } finally {
    requestAbort.abort();
    devices.connect();
    native.push({ type: "done", reason: "stop", message: answer("Synthetic answer continues") });
    await ingress.close();
    await registry.close();
    await rm(root, { recursive: true, force: true });
  }
});
