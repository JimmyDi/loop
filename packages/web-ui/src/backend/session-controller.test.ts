import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { expect, test } from "vitest";
import { createAssistantMessageEventStream, Type } from "@earendil-works/pi-ai";

import { AgentSession, SessionManager } from "@loop/coding-agent";
import type { ModelRuntime } from "@loop/coding-agent";
import type { Frame, ListFrame } from "../shared/protocol";
import { ListEvents } from "./list-events";
import { SessionController } from "./session-controller";
import { sessionRoutes } from "./routes/sessions";
import type { SessionRegistry } from "./session-registry";
import { fileContent, readFileContent } from "../shared/prompt-files";
import { MAX_IMAGE_BYTES } from "../shared/prompt-images";
import { eventResponse } from "./http/sse";

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
  for (let i = 0; i < 100 && !condition(); i++) await sleep(2);

  expect(condition()).toBe(true);
};

test("approval events keep snapshots current without requiring a prompt or enabling an answerer", async () => {
  const session = new AgentSession({
    model,
    systemPrompt: "Test",
    tools: [],
    sessionManager: SessionManager.inMemory(),
    modelRuntime: runtime(() => createAssistantMessageEventStream()),
  });
  const controller = new SessionController(session, "project");
  const input = { toolName: "write", toolCallId: "test-call", reason: "Review operation" };
  const frames: Frame[] = [];
  const unsubscribe = controller.events.connect((frame) => frames.push(frame));
  frames.length = 0;
  try {
    expect((await session.requestApproval(input)).outcome).toBe("unavailable");
    expect(controller.snapshot.state.pendingApprovals).toEqual([]);
    session.registerApprovalHandler(() => {});
    const pending = session.requestApproval(input);
    expect(controller.snapshot.state.pendingApprovals).toHaveLength(1);
    expect(controller.snapshot.runId).toBeUndefined();
    await session.abort();
    expect((await pending).outcome).toBe("cancelled");
    expect(controller.snapshot.state.pendingApprovals).toEqual([]);
    expect(frames.every((frame) => frame.type === "session.state")).toBe(true);
    expect(frames).toHaveLength(4);
  } finally {
    unsubscribe();
    await controller.close();
  }
});

test("large files bypass local context estimates and accepted requests still deduplicate", async () => {
  let calls = 0;
  const session = new AgentSession({
    model,
    systemPrompt: "Test",
    tools: [],
    sessionManager: SessionManager.inMemory(),
    modelRuntime: runtime(() => {
      calls++;
      const stream = createAssistantMessageEventStream();
      stream.push({ type: "done", reason: "stop", message: answer("Read") });
      return stream;
    }),
  });
  const controller = new SessionController(session, "project");
  const files = [{ name: "large.ts", text: "const value = 1;\n".repeat(12000) }];
  try {
    const runId = controller.prompt("retry", "Review", [], files);
    await waitFor(() => !controller.busy);
    expect(calls).toBe(1);
    expect(controller.prompt("retry", "Review", [], files)).toBe(runId);
  } finally {
    await controller.close();
  }
});

test("text and image attachments larger than the former request cap arrive without truncation", async () => {
  const files = [
    { name: "one.txt", text: "\t".repeat(2 * 1024 * 1024) },
    { name: "two.txt", text: "中".repeat(512 * 1024) },
  ];
  const images = [
    {
      type: "image" as const,
      mimeType: "image/png",
      data: Buffer.alloc(MAX_IMAGE_BYTES).toString("base64"),
    },
  ];
  let received: unknown;
  const session = new AgentSession({
    model: { ...model, input: ["text", "image"], contextWindow: 1000000 },
    systemPrompt: "Test",
    tools: [],
    sessionManager: SessionManager.inMemory(),
    modelRuntime: runtime((_model, context) => {
      received = context.messages[0]?.content;
      const stream = createAssistantMessageEventStream();
      stream.push({ type: "done", reason: "stop", message: answer("Read") });
      return stream;
    }),
  });
  const controller = new SessionController(session, "project");
  const route = sessionRoutes({
    get: async () => controller,
    assertAvailable: () => {},
  } as unknown as SessionRegistry);
  const url = new URL("http://localhost/api/sessions/example/prompt");
  const body = JSON.stringify({ requestId: "large", text: "", files, images });
  try {
    expect(Buffer.byteLength(body)).toBeGreaterThan(8 * 1024 * 1024);
    const response = await route(
      new Request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body }),
      url,
    );
    expect(response?.status).toBe(202);
    await waitFor(() => !controller.busy);
    expect(received).toEqual([
      images[0],
      ...files.map((file) => ({ type: "text", text: fileContent(file) })),
    ]);
    expect(session.state.outcome).toBe("success");
  } finally {
    await controller.close();
  }
});

test("text files reach a text-only model, deduplicate by name and content, and survive disk reload", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".text-files-test-"));
  const manager = await SessionManager.create(root, root);
  let calls = 0;
  let received: unknown;
  const session = new AgentSession({
    model,
    sessionManager: manager,
    systemPrompt: "Test",
    tools: [],
    modelRuntime: runtime((_model, context) => {
      calls++;
      received = context.messages[0]?.content;
      const stream = createAssistantMessageEventStream();
      stream.push({ type: "done", reason: "stop", message: answer("Read") });
      return stream;
    }),
  });
  const controller = new SessionController(session, "project");
  const route = sessionRoutes({
    get: async () => controller,
    assertAvailable: () => {},
  } as unknown as SessionRegistry);
  const url = new URL("http://localhost/api/sessions/example/prompt");
  const submit = (files: unknown, text = "") =>
    route(
      new Request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: "files", text, files }),
      }),
      url,
    );
  const file = { name: "example.ts", text: "const message = '中文';\n".repeat(25000) };
  try {
    for (const files of [
      [{ ...file, name: "example.pdf" }],
      [{ ...file, text: "binary\0" }],
      Array(5).fill(file),
    ]) {
      await expect(submit(files)).rejects.toMatchObject({
        status: 400,
        code: "invalid_text_files",
      });
    }
    expect(calls).toBe(0);
    expect(controller.snapshot.operation).toBe("idle");
    const accepted = await submit([file]);
    expect(accepted?.status).toBe(202);
    expect(await (await submit([file]))?.json()).toEqual(await accepted?.json());
    await expect(submit([{ ...file, name: "renamed.ts" }])).rejects.toMatchObject({
      code: "request_conflict",
    });
    await expect(submit([{ ...file, text: "Changed" }])).rejects.toMatchObject({
      code: "request_conflict",
    });
    await waitFor(() => !controller.busy);
    expect(calls).toBe(1);
    expect(session.state.outcome).toBe("success");
    expect(received).toEqual(session.state.messages[0]?.content);
    const record = (await SessionManager.list(root, root)).find(
      (entry) => entry.id === session.sessionId,
    )!;
    const restored = await SessionManager.open(record.path);
    const messages = restored.messages;
    expect(messages).toEqual(session.state.messages);
    const content = messages[0]?.content;
    expect(Array.isArray(content)).toBe(true);
    if (Array.isArray(content) && content[0]?.type === "text")
      expect(readFileContent(content[0].text)).toEqual(file);
  } finally {
    await controller.close();
    await rm(root, { recursive: true, force: true });
  }
});

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
  const thought = {
    ...partial,
    content: [{ type: "thinking" as const, thinking: "Check the result" }],
  };

  stream.push({ type: "start", partial: thought });
  stream.push({
    type: "thinking_delta",
    contentIndex: 0,
    delta: "Check the result",
    partial: thought,
  });
  await waitFor(() => controller.snapshot.state.draft?.content[0]?.type === "thinking");
  stream.push({
    type: "thinking_end",
    contentIndex: 0,
    content: "Check the result",
    partial: thought,
  });
  await waitFor(() =>
    frames.some(
      (frame) =>
        frame.type === "loop.event" &&
        frame.event.type === "message_update" &&
        frame.event.assistantMessageEvent.type === "thinking_end",
    ),
  );
  const thinkingFrames: Frame[] = [];
  const stopThinkingFrames = controller.events.connect((frame) => thinkingFrames.push(frame));
  expect(thinkingFrames[0]).toMatchObject({
    type: "session.snapshot",
    snapshot: { operation: "prompt", state: { draft: thought } },
  });
  stopThinkingFrames();

  stream.push({ type: "start", partial });
  stream.push({ type: "text_delta", contentIndex: 0, delta: "hel", partial });
  stream.push({ type: "text_delta", contentIndex: 0, delta: "lo", partial: answer("hello") });
  stream.push({ type: "done", reason: "stop", message: answer("hello") });
  await waitFor(() => controller.snapshot.operation === "idle");
  expect(session.state.messages).toHaveLength(2);
  expect(controller.snapshot.state.messages).toEqual(session.state.messages);
  expect(
    frames.filter((frame) => frame.type === "session.state" && frame.snapshot.operation === "idle"),
  ).toHaveLength(1);
  expect(controller.snapshot.state.draft).toBeUndefined();
  expect(calls).toBe(1);
  const timing = controller.snapshot.state.promptTimings?.[0];
  expect(timing?.userMessageIndex).toBe(0);
  expect(timing?.finishedAt).toBeGreaterThanOrEqual(timing!.startedAt);
  expect(
    frames.filter((frame) => frame.type === "loop.event" && frame.event.type === "prompt_timing"),
  ).toHaveLength(2);
  const reconnected: Frame[] = [];
  const disconnect = controller.events.connect((frame) => reconnected.push(frame));
  expect(reconnected[0]).toMatchObject({
    type: "session.snapshot",
    snapshot: {
      operation: "idle",
      state: { messages: session.state.messages, promptTimings: [timing] },
    },
  });
  disconnect();
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

test("SSE delivers commentary and running tool state while execution is still pending", async () => {
  const stream = createAssistantMessageEventStream();
  let calls = 0;
  let executing = false;
  let release = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const session = new AgentSession({
    model,
    systemPrompt: "Test",
    sessionManager: SessionManager.inMemory(),
    modelRuntime: runtime(() => {
      if (++calls === 1) return stream;
      const final = createAssistantMessageEventStream();
      final.push({ type: "done", reason: "stop", message: answer("Done") });
      return final;
    }),
    tools: [
      {
        name: "bash",
        description: "Synthetic gated tool",
        parameters: Type.Object({}),
        execute: async () => {
          executing = true;
          await pending;
          return [{ type: "text", text: "Example output" }];
        },
      },
    ],
  });
  const controller = new SessionController(session, "project");
  const response = eventResponse(controller.events, new Request("http://localhost/events"));
  const reader = response.body!.getReader();
  const received: Frame[] = [];
  const until = async (matches: (frame: Frame) => boolean) => {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) throw new Error("SSE closed before expected event");
      for (const line of new TextDecoder().decode(chunk.value).split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const frame = JSON.parse(line.slice(6)) as Frame;
        received.push(frame);
        if (matches(frame)) return frame;
      }
    }
  };
  try {
    controller.prompt("stream-request", "Inspect files");
    await waitFor(() => calls === 1);
    stream.push({ type: "start", partial: answer("") });
    const partial = answer("Inspect");
    stream.push({ type: "text_delta", contentIndex: 0, delta: partial.content[0]!.text, partial });
    const frame = await until(
      (frame) => frame.type === "loop.event" && frame.event.type === "message_update",
    );
    expect(frame).toMatchObject({
      type: "loop.event",
      event: { assistantMessageEvent: { type: "text_delta" } },
    });
    expect(executing).toBe(false);
    const update = answer("Inspect the configuration.");
    stream.push({
      type: "text_delta",
      contentIndex: 0,
      delta: " the configuration.",
      partial: update,
    });
    const tool = {
      ...update,
      stopReason: "toolUse" as const,
      content: [
        ...update.content,
        { type: "toolCall" as const, id: "live", name: "bash", arguments: {} },
      ],
    };
    stream.push({ type: "toolcall_start", contentIndex: 1, partial: tool });
    stream.push({ type: "done", reason: "toolUse", message: tool });
    await until(
      (frame) => frame.type === "loop.event" && frame.event.type === "tool_execution_start",
    );
    await waitFor(() => executing);
    expect(controller.snapshot.tools.live?.status).toBe("running");
    expect(controller.snapshot.tools.live?.result).toBeUndefined();
    expect(
      received.some(
        (frame) => frame.type === "loop.event" && frame.event.type === "tool_execution_end",
      ),
    ).toBe(false);
    const restored: Frame[] = [];
    const disconnect = controller.events.connect((frame) => restored.push(frame));
    expect(restored[0]).toMatchObject({
      type: "session.snapshot",
      snapshot: { tools: { live: { status: "running" } } },
    });
    disconnect();
    release();
    await until(
      (frame) => frame.type === "loop.event" && frame.event.type === "tool_execution_end",
    );
    expect(controller.snapshot.tools.live?.status).toBe("success");
    await until((frame) => frame.type === "session.state" && frame.snapshot.operation === "idle");
    expect(controller.snapshot.state.outcome).toBe("success");
  } finally {
    release();
    await reader.cancel();
    await controller.close();
  }
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

test("late title updates publish outside a run, replay on reconnect, and support rename/refresh routes", async () => {
  const titleStream = createAssistantMessageEventStream();
  let generated = false;
  const session = new AgentSession({
    model,
    sessionManager: SessionManager.inMemory(),
    systemPrompt: "Main",
    tools: [],
    title: { mode: "first-prompt" },
    modelRuntime: runtime((_model, context) => {
      if (context.systemPrompt !== "Main" && !generated) {
        generated = true;
        return titleStream;
      }
      const stream = createAssistantMessageEventStream();
      stream.push({
        type: "done",
        reason: "stop",
        message: answer(context.systemPrompt === "Main" ? "Main answer" : "Generated title"),
      });
      return stream;
    }),
  });
  const controller = new SessionController(session, "project");
  const frames: Frame[] = [];
  const disconnect = controller.events.connect((frame) => frames.push(frame));
  const lists = new ListEvents();
  const changes: ListFrame[] = [];
  lists.watch(controller);
  lists.connect((frame) => changes.push(frame));
  try {
    controller.prompt("title-request", "Example task");
    await waitFor(() => !controller.busy && generated);
    expect(controller.snapshot.state.messages).toHaveLength(2);
    const beforeTitle = changes.length;
    titleStream.push({ type: "done", reason: "stop", message: answer("Generated title") });
    await session.waitForTitle();
    expect(changes.length).toBeGreaterThan(beforeTitle);
    expect(changes.at(-1)).toMatchObject({ type: "sessions.changed", workspaceId: "project" });
    expect(frames.at(-1)).toMatchObject({
      type: "session.state",
      snapshot: { operation: "idle", state: { title: { text: "Generated title" } } },
    });
    const route = sessionRoutes({
      get: async () => controller,
      assertAvailable: () => {},
    } as unknown as SessionRegistry);
    disconnect();
    const beforeRename = changes.length;
    const url = new URL("http://localhost/api/sessions/" + session.sessionId + "/title");
    const renamed = await route(
      new Request(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Manual title" }),
      }),
      url,
    );
    expect(renamed?.status).toBe(200);
    expect(changes.length).toBeGreaterThan(beforeRename);
    expect(controller.snapshot.state.title).toMatchObject({ source: "user", text: "Manual title" });
    const refreshed = await route(new Request(url, { method: "POST" }), url);
    expect(refreshed?.status).toBe(200);
    expect(controller.snapshot.state.title?.source).toBe("model");
    disconnect();
    const reconnect: Frame[] = [];
    const close = controller.events.connect((frame) => reconnect.push(frame));
    expect(reconnect[0]).toMatchObject({
      type: "session.snapshot",
      snapshot: { state: { title: { text: "Generated title" } } },
    });
    close();
    expect(session.state.messages).toHaveLength(2);
  } finally {
    disconnect();
    lists.close();
    await controller.close();
  }
});
