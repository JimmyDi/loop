import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { AssistantMessage, Context, Message, Model } from "@earendil-works/pi-ai";
import { expect, test } from "vitest";

import { AgentSession } from "../agent-session";
import { SessionManager } from "../session-manager";
import { compactSession } from "./compact-session";
import { NothingToCompactError } from "./compaction-error";

const model: Model<"openai-completions"> = {
  id: "fixture",
  name: "Fixture",
  provider: "fixture",
  api: "openai-completions",
  baseUrl: "https://example.invalid",
  input: ["text"],
  reasoning: false,
  contextWindow: 32000,
  maxTokens: 512,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
};

const response = (
  text = "Goal: finish review. Next: add tests.",
  reason: AssistantMessage["stopReason"] = "stop",
): AssistantMessage => ({
  role: "assistant",
  content: [{ type: "text", text }],
  stopReason: reason,
  api: model.api,
  provider: model.provider,
  model: model.id,
  timestamp: 1,
  usage: {
    input: 123,
    output: 15,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 138,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
});

test("availability follows model retention changes without generating summaries", async () => {
  const manager = SessionManager.inMemory();
  await manager.commit([
    { role: "user", content: "x".repeat(26000), timestamp: 1 },
    { role: "user", content: "Latest question", timestamp: 2 },
  ]);
  const session = new AgentSession({
    model,
    sessionManager: manager,
    systemPrompt: "Rules",
    tools: [],
    modelRuntime: {
      getModel: () => model,
      getModels: () => [model],
      checkModel: async () => {},
      streamSimple: () => {
        throw new Error("Must not dispatch");
      },
    },
  });
  try {
    expect(session.state.compactionAvailable).toBe(true);
    await session.setModel({ ...model, contextWindow: 200000 });
    expect(session.state.compactionAvailable).toBe(false);
    await session.setModel(model);
    expect(session.state.compactionAvailable).toBe(true);
  } finally {
    session.dispose();
  }
});

test.each([false, true])(
  "short context skips authentication, model dispatch and storage writes (previous checkpoint: %s)",
  async (hasCheckpoint) => {
    const root = await mkdtemp(join(tmpdir(), "loop-compact-short-"));
    const manager = await SessionManager.create(root, join(root, "sessions"));
    const history: Message[] = [
      ...(hasCheckpoint
        ? [{ role: "user" as const, content: "x".repeat(26000), timestamp: 0 }]
        : []),
      { role: "user", content: "Explain the project", timestamp: 1 },
      response("Project overview"),
      { role: "user", content: "Where should I start?", timestamp: 2 },
      response("Start with the entry point"),
    ];
    const checkpoints = hasCheckpoint
      ? [
          {
            id: "00000000-0000-4000-8000-000000000001",
            firstKeptMessageIndex: 1,
            historyMessageCount: history.length,
            summary: "Previous work",
            timestamp: 1,
            provider: model.provider,
            model: model.id,
            usage: response().usage,
          },
        ]
      : [];
    await manager.commit(history, undefined, undefined, { compactions: checkpoints });
    const before = await readFile(manager.sessionFile!, "utf8");
    let checks = 0;
    let calls = 0;
    const session = new AgentSession({
      model,
      tools: [],
      systemPrompt: "Rules",
      sessionManager: manager,
      modelRuntime: {
        getModel: () => model,
        getModels: () => [model],
        checkModel: async () => {
          checks++;
        },
        streamSimple: () => {
          calls++;
          throw new Error("Must not dispatch");
        },
      },
    });
    try {
      expect(session.state.compactionAvailable).toBe(false);
      const budget = session.state.contextBudget;
      await expect(session.compact()).rejects.toThrow(NothingToCompactError);
      expect(session.state.contextBudget).toEqual(budget);
      expect(checks).toBe(0);
      expect(calls).toBe(0);
      expect(manager.messages).toEqual(history);
      expect(manager.getCompactions()).toEqual(checkpoints);
      expect(manager.hasPendingSave).toBe(false);
      expect(session.state.isRunning).toBe(false);
      expect(session.state.outcome).toBe("idle");
      expect(session.state.error).toBeUndefined();
      expect(await readFile(manager.sessionFile!, "utf8")).toBe(before);
    } finally {
      session.dispose();
      await rm(root, { recursive: true, force: true });
    }
  },
);

test("summary checkpoints survive restart, update incrementally and preserve complete paired tool history", async () => {
  const root = await mkdtemp(join(tmpdir(), "loop-compact-"));
  const requests: Context[] = [];
  const manager = await SessionManager.create(root, join(root, "sessions"));
  const call = {
    ...response(),
    stopReason: "toolUse" as const,
    content: [
      { type: "toolCall" as const, id: "read-1", name: "read", arguments: { path: "fixture.txt" } },
    ],
  };
  const history: Message[] = [
    { role: "user", content: "Review the fixture", timestamp: 1 },
    call,
    {
      role: "toolResult",
      toolName: "read",
      toolCallId: "read-1",
      content: [{ type: "text", text: "Fixture content" }],
      isError: false,
      timestamp: 2,
    },
    response("Read completed"),
    { role: "user", content: "Add tests" + "x".repeat(26000), timestamp: 3 },
    response(),
  ];
  await manager.commit(history, [
    {
      userTurn: 0,
      content: "<skill>Check correctness" + "x".repeat(26000) + "</skill>",
      placement: "user",
      timestamp: 1,
    },
  ]);
  const runtime = {
    getModel: () => model,
    getModels: () => [model],
    checkModel: async () => {},
    streamSimple: (_model: Model<any>, context: Context) => {
      requests.push(structuredClone(context));
      const stream = createAssistantMessageEventStream();
      stream.push({ type: "done", reason: "stop", message: response() });
      return stream;
    },
  };
  let session = new AgentSession({
    model,
    modelRuntime: runtime,
    sessionManager: manager,
    systemPrompt: "Current rules",
    tools: [],
  });
  try {
    const beforeBudget = session.state.contextBudget!;
    expect(session.state.compactionAvailable).toBe(true);
    await session.compact();
    expect(session.state.compactionAvailable).toBe(false);
    expect(session.state.contextBudget?.estimatedInputTokens).toBeLessThan(
      beforeBudget.estimatedInputTokens,
    );
    expect(session.state.contextBudget?.systemTokens).toBe(beforeBudget.systemTokens);
    const compactedBudget = session.state.contextBudget;
    expect(manager.messages).toEqual(history);
    expect(manager.getCompactions()[0]).toMatchObject({
      firstKeptMessageIndex: 4,
      historyMessageCount: 6,
      usage: { input: 123 },
    });
    expect(requests[0]?.tools).toEqual([]);
    expect(JSON.stringify(requests[0]?.messages)).toContain("Check correctness");
    expect(JSON.stringify(requests[0]?.messages)).toContain("Fixture content");
    expect(JSON.stringify(requests[0]?.messages)).not.toContain("Add tests");
    session.dispose();
    const reopened = await SessionManager.open(manager.sessionFile!);
    session = new AgentSession({
      model,
      modelRuntime: runtime,
      sessionManager: reopened,
      systemPrompt: "Current rules",
      tools: [],
    });
    expect(session.state.contextBudget).toEqual(compactedBudget);
    expect(session.state.compactionAvailable).toBe(false);
    expect(session.modelInputProjection).toBeUndefined();
    await session.prompt("Continue");
    const sent = requests.at(-1)!;
    expect(sent.messages[0]?.content).toContain("<summary>");
    expect(sent.messages[1]?.content).toBe(history[4]?.content);
    expect(JSON.stringify(sent.messages)).not.toContain("Fixture content");
    expect(reopened.messages.slice(0, history.length)).toEqual(history);
    expect(session.modelInputProjection?.sources[0]?.type).toBe("compaction");
    const before = reopened.messages;
    expect(session.state.compactionAvailable).toBe(true);
    await session.compact();
    expect(session.state.compactionAvailable).toBe(false);
    expect(reopened.messages).toEqual(before);
    expect(reopened.getCompactions()).toHaveLength(2);
    expect(reopened.getCompactions()[1]?.firstKeptMessageIndex).toBe(6);
    expect(JSON.stringify(requests.at(-1)?.messages)).toContain("previousSummary");
  } finally {
    await session.abort();
    session.dispose();
    await rm(root, { recursive: true, force: true });
  }
});

test.each(["user", undefined] as const)(
  "uses projected instructions to choose the boundary when original messages are short (%s)",
  async (placement) => {
    const manager = SessionManager.inMemory();
    const history: Message[] = [1, 2, 3].map((timestamp) => ({
      role: "user",
      content: "Question " + timestamp,
      timestamp,
    }));
    const content = "<skill>" + "x".repeat(26000) + "</skill>";
    await manager.commit(history, [
      { userTurn: 1, content, timestamp: 2, ...(placement ? { placement } : {}) },
    ]);
    const requests: Context[] = [];
    const runtime = {
      getModel: () => model,
      getModels: () => [model],
      checkModel: async () => {},
      streamSimple: (_model: Model<any>, context: Context) => {
        requests.push(structuredClone(context));
        const stream = createAssistantMessageEventStream();
        stream.push({ type: "done", reason: "stop", message: response() });
        return stream;
      },
    };
    await compactSession(manager, runtime, model, new AbortController().signal);
    expect(manager.getCompactions()[0]?.firstKeptMessageIndex).toBe(2);
    expect(manager.messages).toEqual(history);
    expect(requests).toHaveLength(1);
    expect(JSON.stringify(requests[0]?.messages)).toContain(content);
    expect(JSON.stringify(requests[0]?.messages)).toContain("Question 1");
    expect(JSON.stringify(requests[0]?.messages)).toContain("Question 2");
    expect(JSON.stringify(requests[0]?.messages)).not.toContain("Question 3");
  },
);

test.each(["length", "error", "empty", "cancel", "tool"])(
  "failed summary (%s) leaves history and checkpoints unchanged",
  async (kind) => {
    const manager = SessionManager.inMemory();
    const history: Message[] = [1, 2].map((timestamp) => ({
      role: "user",
      content: timestamp === 1 ? "x".repeat(26000) : "Task 2",
      timestamp,
    }));
    await manager.commit(history);
    const started = Promise.withResolvers<void>();
    let calls = 0;
    const runtime = {
      getModel: () => model,
      getModels: () => [model],
      checkModel: async () => {},
      streamSimple: () => {
        calls++;
        started.resolve();
        const stream = createAssistantMessageEventStream();
        if (kind !== "cancel") {
          const message =
            kind === "tool"
              ? {
                  ...response(),
                  stopReason: "toolUse" as const,
                  content: [
                    { type: "toolCall" as const, id: "forbidden", name: "write", arguments: {} },
                  ],
                }
              : response(
                  kind === "empty" ? "" : "Summary",
                  kind === "length" ? "length" : kind === "error" ? "error" : "stop",
                );
          if (message.stopReason === "error")
            stream.push({ type: "error", reason: "error", error: message });
          else stream.push({ type: "done", reason: message.stopReason as "stop", message });
        }
        return stream;
      },
    };
    const session = new AgentSession({
      model,
      modelRuntime: runtime,
      sessionManager: manager,
      systemPrompt: "Rules",
      tools: [],
    });
    const pending = session.compact();
    const rejected = expect(pending).rejects.toThrow();
    await started.promise;
    await expect(session.prompt("Cannot overlap")).rejects.toThrow("already running");
    if (kind === "cancel") await session.abort();
    await rejected;
    expect(calls).toBe(1);
    expect(manager.messages).toEqual(history);
    expect(manager.getCompactions()).toEqual([]);
    expect(manager.hasPendingSave).toBe(false);
    expect(session.state.outcome).toBe(kind === "cancel" ? "cancelled" : "error");
    session.dispose();
  },
);

test("failed checkpoint save can be flushed without generating the summary again", async () => {
  const root = await mkdtemp(join(tmpdir(), "loop-compact-save-"));
  const storage = join(root, "sessions");
  const manager = await SessionManager.create(root, storage);
  const history = [1, 2].map((timestamp) => ({
    role: "user" as const,
    content: timestamp === 1 ? "x".repeat(26000) : "Task 2",
    timestamp,
  }));
  await manager.commit(history);
  const before = await readFile(manager.sessionFile!, "utf8");
  let calls = 0;
  const runtime = {
    getModel: () => model,
    getModels: () => [model],
    checkModel: async () => {},
    streamSimple: () => {
      calls++;
      const stream = createAssistantMessageEventStream();
      stream.push({ type: "done", reason: "stop", message: response() });
      return stream;
    },
  };
  try {
    await rename(storage, storage + "-old");
    await writeFile(storage, "Block writes");
    await expect(
      compactSession(manager, runtime, model, new AbortController().signal),
    ).rejects.toThrow();
    expect(manager.messages).toEqual(history);
    expect(manager.hasPendingSave).toBe(true);
    expect(manager.getCompactions()).toHaveLength(1);
    expect(await readFile(join(storage + "-old", manager.getSessionId() + ".jsonl"), "utf8")).toBe(
      before,
    );
    await rm(storage);
    await rename(storage + "-old", storage);
    await manager.flush();
    expect(calls).toBe(1);
    expect((await SessionManager.open(manager.sessionFile!)).getCompactions()).toHaveLength(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
