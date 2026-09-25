import { expect, test } from "bun:test";
import { createAssistantMessageEventStream, Type } from "@earendil-works/pi-ai";

import { AgentSession, SessionManager } from "../../coding-agent/index";
import type { ModelRuntime } from "../../coding-agent/index";
import type { Frame } from "../shared/protocol";
import { SessionController } from "./session-controller";

const model = {
  id: "test",
  name: "Test",
  provider: "test",
  api: "openai-completions" as const,
  baseUrl: "http://localhost",
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

const runtime = (streamSimple: ModelRuntime["streamSimple"], checkModel = async () => {}) => ({
  streamSimple,
  checkModel,
  getModel: () => model,
  getModels: () => [model],
});

const waitFor = async (condition: () => boolean) => {
  for (let i = 0; i < 100 && !condition(); i++) await Bun.sleep(2);

  expect(condition()).toBe(true);
};

test("accepted requests deduplicate and drafts do not duplicate history", async () => {
  const stream = createAssistantMessageEventStream();
  let calls = 0;
  const session = new AgentSession({
    model,
    modelRuntime: runtime(() => {
      calls++;
      return stream;
    }),
    sessionManager: SessionManager.inMemory(),
    systemPrompt: "Test",
    tools: [],
  });
  const controller = new SessionController(session, "project");
  const frames: Frame[] = [];

  controller.events.connect((frame) => frames.push(frame));

  const run = controller.prompt("request", "hello");

  expect(controller.prompt("request", "hello")).toBe(run);
  expect(() => controller.prompt("request", "different")).toThrow("request_conflict");
  expect(() => controller.prompt("second", "hello")).toThrow("session_busy");
  expect(frames[1]?.type).toBe("run.accepted");
  await waitFor(() => calls === 1);
  const partial = answer("hel");

  stream.push({ type: "start", partial });
  stream.push({ type: "text_delta", contentIndex: 0, delta: "hel", partial });
  stream.push({ type: "text_delta", contentIndex: 0, delta: "lo", partial: answer("hello") });
  stream.push({ type: "done", reason: "stop", message: answer("hello") });
  await waitFor(() => controller.snapshot.operation === "idle");
  expect(session.state.messages).toHaveLength(2);
  expect(controller.snapshot.state.messages).toEqual(session.state.messages);
  expect(frames.filter((frame) => frame.type === "session.state")).toHaveLength(1);
  expect(controller.snapshot.state.draft).toBeUndefined();
  expect(calls).toBe(1);
  await controller.close();
});

test("preflight failure settles once; abort prevents later model requests", async () => {
  let calls = 0;
  let reject = true;
  const session = new AgentSession({
    model,
    modelRuntime: runtime(
      () => {
        calls++;

        return createAssistantMessageEventStream();
      },
      async () => {
        if (reject) throw new Error("No credentials");
      },
    ),
    sessionManager: SessionManager.inMemory(),
    systemPrompt: "Test",
    tools: [],
  });
  const controller = new SessionController(session, "project");

  controller.prompt("first", "hello");
  await waitFor(() => controller.snapshot.operation === "idle");
  expect(controller.snapshot.state.error).toContain("No credentials");
  expect(calls).toBe(0);
  reject = false;
  controller.prompt("second", "hello");
  await waitFor(() => calls === 1);
  await controller.abort();
  expect(controller.snapshot.state.outcome).toBe("cancelled");
  expect(controller.snapshot.operation).toBe("idle");
  await controller.close();
});

test("sequential tool results keep canonical indexes across multiple model turns", async () => {
  let turns = 0;
  const modelRuntime = runtime((_model, context) => {
    const stream = createAssistantMessageEventStream();
    const message =
      turns++ === 0
        ? {
            ...answer(""),
            stopReason: "toolUse" as const,
            content: [
              { type: "toolCall" as const, id: "one", name: "read", arguments: {} },
              { type: "toolCall" as const, id: "two", name: "missing", arguments: {} },
            ],
          }
        : answer("done");

    if (turns === 2)
      expect(context.messages.filter((message) => message.role === "toolResult")).toHaveLength(2);

    stream.push({ type: "start", partial: message });
    stream.push({ type: "done", reason: message.stopReason, message });

    return stream;
  });
  const session = new AgentSession({
    model,
    modelRuntime,
    sessionManager: SessionManager.inMemory(),
    systemPrompt: "Test",
    tools: [
      {
        name: "read",
        description: "Test",
        parameters: Type.Object({}),
        execute: () => [{ type: "text", text: "result" }],
      },
    ],
  });
  const controller = new SessionController(session, "project");

  controller.prompt("tool-request", "read");
  await waitFor(() => controller.snapshot.operation === "idle");
  expect(controller.snapshot.state.messages).toHaveLength(5);
  expect(controller.snapshot.state.messages).toEqual(session.state.messages);
  expect(controller.snapshot.tools.one?.status).toBe("success");
  expect(controller.snapshot.tools.two?.status).toBe("error");
  await controller.close();
});

test("failed flush preserves pending history and model failure releases operation", async () => {
  const manager = SessionManager.inMemory();
  const session = new AgentSession({
    model,
    modelRuntime: runtime(() => createAssistantMessageEventStream()),
    sessionManager: manager,
    systemPrompt: "Test",
    tools: [],
  });
  const controller = new SessionController(session, "project");

  await expect(
    controller.command("model", async () => {
      throw new Error("model failed");
    }),
  ).rejects.toThrow();
  expect(controller.snapshot.operation).toBe("idle");
  const flush = manager.flush.bind(manager);

  manager.flush = async () => {
    throw new Error("disk failed");
  };
  await manager.commit([{ role: "user", content: "keep", timestamp: 0 }]).catch(() => {});
  await expect(controller.command("flush", () => session.flush())).rejects.toThrow("disk failed");
  expect(controller.snapshot.state.hasPendingSave).toBe(true);
  expect(() => controller.prompt("request", "hello")).toThrow("pending_save");
  manager.flush = flush;
  await controller.command("flush", () => session.flush());
  expect(controller.snapshot.state.hasPendingSave).toBe(false);
  expect(controller.snapshot.state.messages).toHaveLength(1);
  await controller.close();
});
