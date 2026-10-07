import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { expect, test } from "vitest";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { Api, AssistantMessage, Context, Model } from "@earendil-works/pi-ai";

import { AgentSession } from "../agent-session";
import type { ModelRuntime } from "../model-runtime";
import { SessionManager } from "../session-manager";
import { SessionTitleService } from "./session-title";
import type { SessionTitleOptions } from "./types";

const model: Model<Api> = {
  id: "example",
  name: "Example",
  provider: "example",
  api: "openai-completions",
  baseUrl: "https://example.invalid",
  input: ["text", "image"],
  reasoning: false,
  contextWindow: 4096,
  maxTokens: 512,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
};

const isMainContext = (context: Context): boolean =>
  context.systemPrompt?.startsWith("Main conversation") === true;

function response(text: string, stopReason: AssistantMessage["stopReason"] = "stop") {
  const message: AssistantMessage = {
    role: "assistant",
    content: [{ type: "text", text }],
    api: model.api,
    model: model.id,
    provider: model.provider,
    timestamp: 1,
    stopReason,
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
  if (stopReason === "error" || stopReason === "aborted")
    stream.push({ type: "error", reason: stopReason, error: message });
  else stream.push({ type: "done", reason: stopReason as "stop", message });
  return stream;
}

function setup(
  streamSimple: ModelRuntime["streamSimple"],
  title: SessionTitleOptions,
  manager = SessionManager.inMemory(),
) {
  const runtime: ModelRuntime = {
    getModel: (provider, id) => ({ ...model, provider, id }),
    getModels: () => [model],
    checkModel: async () => {},
    streamSimple,
  };
  const session = new AgentSession({
    model,
    modelRuntime: runtime,
    sessionManager: manager,
    tools: [],
    systemPrompt: "Main conversation",
    title,
  });
  return { session, runtime, manager };
}

async function until(predicate: () => boolean) {
  for (let i = 0; i < 200 && !predicate(); i++) await sleep(2);
  expect(predicate()).toBe(true);
}

test("first-prompt titles run independently, persist, and never enter conversation history", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".title-test-"));
  const manager = await SessionManager.create(root, root);
  const contexts: Context[] = [];
  let complete!: (stream: ReturnType<typeof response>) => void;
  let titleRequests = 0;
  const { session } = setup(
    (_model, context) => {
      contexts.push(structuredClone(context));
      if (!isMainContext(context)) {
        titleRequests++;
        return new Promise((resolve) => {
          complete = resolve;
        });
      }
      return response("main answer");
    },
    { mode: "first-prompt" },
    manager,
  );
  try {
    await session.prompt("修复设置页面语言切换");
    await until(() => titleRequests === 1);
    expect(session.isRunning).toBe(false);
    expect(session.state.title).toMatchObject({ source: "fallback", text: "修复设置页面语言切换" });
    expect(session.state.messages).toHaveLength(2);
    complete(response("设置语言切换修复"));
    await session.waitForTitle();
    expect(session.state.title).toMatchObject({
      source: "model",
      text: "设置语言切换修复",
      messageIndices: [0],
    });
    await session.prompt("补充回归测试");
    await session.waitForTitle();
    expect(titleRequests).toBe(1);
    const main = contexts.filter(isMainContext);
    expect(main.map((context) => context.messages.length)).toEqual([1, 3]);
    for (const context of main) {
      expect(context.systemPrompt).toContain("<tools>");
      expect(context.systemPrompt).toContain("<tool_usage>");
    }
    expect(JSON.stringify(main)).not.toContain("设置语言切换修复");
    const titleContext = contexts.find((context) => !isMainContext(context))!;
    expect(titleContext.tools).toEqual([]);
    expect(titleContext.systemPrompt).not.toContain("<tools>");
    expect(titleContext.systemPrompt).not.toContain("<tool_usage>");
    expect(titleContext.messages).toHaveLength(1);
    expect(JSON.stringify(titleContext.messages)).not.toContain("main answer");
    const restored = await SessionManager.open(manager.sessionFile!);
    expect(restored.getHeader().title).toEqual(session.state.title);
    expect(restored.messages).toHaveLength(4);
    expect((await SessionManager.list(root, root))[0]?.title?.text).toBe("设置语言切换修复");
  } finally {
    await session.abort();
    session.dispose();
    await rm(root, { recursive: true, force: true });
  }
});

test("all-prompts supersedes stale work, manual rename pins, refresh unpins", async () => {
  const pending: {
    resolve: (stream: ReturnType<typeof response>) => void;
    signal: AbortSignal;
    context: Context;
  }[] = [];
  const { session } = setup(
    (_model, context, options) => {
      if (isMainContext(context)) return response("answer");
      return new Promise((resolve) => pending.push({ resolve, signal: options!.signal!, context }));
    },
    { mode: "all-prompts" },
  );
  try {
    await session.prompt("first task");
    await until(() => pending.length === 1);
    await session.prompt("second task");
    await until(() => pending.length === 2);
    expect(pending[0]!.signal.aborted).toBe(true);
    pending[1]!.resolve(response("Combined tasks"));
    await session.waitForTitle();
    pending[0]!.resolve(response("Stale title"));
    expect(session.state.title?.text).toBe("Combined tasks");
    expect(session.state.title?.messageIndices).toEqual([0, 2]);
    expect(JSON.stringify(pending[1]!.context)).toContain("second task");
    await session.prompt("third task");
    await until(() => pending.length === 3);
    await session.renameTitle("Pinned name");
    expect(pending[2]!.signal.aborted).toBe(true);
    pending[2]!.resolve(response("Late title"));
    await session.prompt("fourth task");
    await session.waitForTitle();
    expect(pending).toHaveLength(3);
    expect(session.state.title?.source).toBe("user");
    const refreshing = session.refreshTitle();
    await until(() => pending.length === 4);
    pending[3]!.resolve(response("Updated tasks"));
    await refreshing;
    expect(session.state.title?.source).toBe("model");
    expect(session.state.title?.messageIndices).toEqual([0, 2, 4, 6]);
  } finally {
    await session.abort();
    session.dispose();
  }
});

test.each(["error", "length", "deferred"] as const)(
  "title %s keeps fallback and main outcome; explicit refresh retries",
  async (reason) => {
    let calls = 0;
    const { session } = setup(
      (_model, context) =>
        isMainContext(context)
          ? response("answer")
          : response(++calls === 1 ? "invalid" : "Recovered", calls === 1 ? reason : "stop"),
      { mode: "first-prompt" },
    );
    try {
      await session.prompt("Example task");
      await session.waitForTitle();
      expect(session.state.outcome).toBe("success");
      expect(session.state.title?.source).toBe("fallback");
      expect(session.state.titleError).toBeDefined();
      await session.prompt("next");
      await session.waitForTitle();
      expect(calls).toBe(1);
      await session.refreshTitle();
      expect(session.state.title?.text).toBe("Recovered");
      expect(session.state.titleError).toBeUndefined();
    } finally {
      await session.abort();
      session.dispose();
    }
  },
);

test("images do not reach titles, image-only input waits, and explicit model uses a bounded request", async () => {
  const calls: { id: string; context: Context; maxTokens?: number }[] = [];
  const { session } = setup(
    (chosen, context, options) => {
      if (!isMainContext(context))
        calls.push({ id: chosen.id, context, maxTokens: options?.maxTokens });
      return response("Image task");
    },
    { mode: "first-prompt", model: { provider: "example", id: "small" }, maxOutputTokens: 64 },
  );
  try {
    const image = { type: "image" as const, data: "AAAA", mimeType: "image/png" };
    await session.prompt([image]);
    await session.waitForTitle();
    expect(session.state.title).toBeUndefined();
    expect(calls).toEqual([]);
    await session.prompt([{ type: "text", text: "Explain diagram" }, image]);
    await session.waitForTitle();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.id).toBe("small");
    expect(calls[0]!.maxTokens).toBe(64);
    expect(JSON.stringify(calls[0]!.context)).not.toContain("AAAA");
    expect(session.state.title?.messageIndices).toEqual([2]);
  } finally {
    await session.abort();
    session.dispose();
  }
});

test("title input overflow retains fallback without requesting a model", async () => {
  let calls = 0;
  const { session } = setup(
    () => {
      calls++;
      return response("answer");
    },
    { mode: "all-prompts", maxInputBytes: 2 },
  );
  await session.prompt("Oversized input");
  await session.waitForTitle();
  expect(calls).toBe(1);
  expect(session.state.titleError).toContain("maxInputBytes");
  session.dispose();
});

test("timeout bounds stalled streams and authentication; cancellation cannot publish late output", async () => {
  const { session, runtime, manager } = setup(
    (_model, context) => (isMainContext(context) ? response("answer") : new Promise(() => {})),
    { mode: "first-prompt", timeoutMs: 20 },
  );
  await session.prompt("Task");
  await session.waitForTitle();
  expect(session.state.title?.source).toBe("fallback");
  expect(session.state.titleError).toBeDefined();
  runtime.checkModel = () => new Promise(() => {});
  const titles = new SessionTitleService(
    manager,
    runtime,
    { mode: "first-prompt", timeoutMs: 20 },
    () => {},
  );
  await expect(titles.refresh(manager.messages, model)).rejects.toThrow();
  titles.dispose();
  session.dispose();
});
