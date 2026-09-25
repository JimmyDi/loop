import { expect, test } from "bun:test";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { Api, AssistantMessage, Context, Model } from "@earendil-works/pi-ai";
import { mkdtemp, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createAgentSession } from "./sdk";
import type { ModelRuntime } from "./model-runtime";
import { SessionManager } from "./session-manager";
import { SettingsManager } from "./settings-manager";

const model: Model<Api> = {
  id: "test",
  provider: "local-test",
  api: "openai-completions",
  name: "Test",
  baseUrl: "https://example.invalid",
  input: ["text"],
  reasoning: false,
  contextWindow: 4096,
  maxTokens: 512,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
};

function answer(
  content: AssistantMessage["content"] = [{ type: "text", text: "done" }],
  reason: AssistantMessage["stopReason"] = "stop",
): AssistantMessage {
  return {
    role: "assistant",
    content,
    api: model.api,
    provider: model.provider,
    model: model.id,
    stopReason: reason,
    timestamp: 1,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
  };
}

function stream(message = answer()) {
  const stream = createAssistantMessageEventStream();

  stream.push({ type: "start", partial: message });
  stream.push({ type: "text_delta", contentIndex: 0, delta: "done", partial: message });

  if (message.stopReason === "error" || message.stopReason === "aborted")
    stream.push({ type: "error", reason: message.stopReason, error: message });
  else stream.push({ type: "done", reason: message.stopReason as "stop", message });

  return stream;
}

function runtime(
  streamSimple: ModelRuntime["streamSimple"],
  checkModel: ModelRuntime["checkModel"] = async () => {},
): ModelRuntime {
  return {
    getModel: (_provider, id) => ({ ...model, id }),
    getModels: () => [model],
    checkModel,
    streamSimple,
  };
}

async function setup(
  modelRuntime: ModelRuntime,
  cwd = process.cwd(),
  sessionManager = SessionManager.inMemory(cwd),
) {
  return createAgentSession({
    cwd,
    model,
    modelRuntime,
    sessionManager,
    settingsManager: SettingsManager.inMemory(),
    noContextFiles: true,
  });
}

test("two prompts create fresh Agents, preserve complete tool history and commit once per activity", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-session-"));
  const contexts: Context[] = [];
  const signals: AbortSignal[] = [];
  const manager = await SessionManager.create(dir, join(dir, "sessions"));
  const { session } = await setup(
    runtime((_model, context, options) => {
      contexts.push(structuredClone(context));
      signals.push(options!.signal!);

      return stream(
        contexts.length === 1
          ? answer(
              [
                {
                  type: "toolCall",
                  id: "write-1",
                  name: "write",
                  arguments: { path: "config.txt", content: "saved" },
                },
              ],
              "toolUse",
            )
          : answer(),
      );
    }),
    dir,
    manager,
  );
  const events: string[] = [];
  let fileDuringRun = "";

  session.subscribe((event) => {
    events.push(event.type);

    if (event.type === "message_update") {
      expect(session.state.draft).toBeDefined();
      expect(session.sessionManager.messages).toHaveLength(contexts.length < 3 ? 0 : 4);
    }
  });
  session.subscribe(async (event) => {
    if (event.type === "tool_execution_start")
      fileDuringRun = await Bun.file(manager.sessionFile!).text();
  });

  try {
    await session.prompt("same input");
    await session.prompt("same input");

    expect(await Bun.file(join(dir, "config.txt")).text()).toBe("saved");
    expect(contexts.map((context) => context.messages.length)).toEqual([1, 3, 5]);
    expect(contexts[1].messages[2]).toMatchObject({
      role: "toolResult",
      toolCallId: "write-1",
      toolName: "write",
      isError: false,
    });
    expect(
      contexts.every(
        (context) =>
          context.tools?.length === 4 && context.systemPrompt === contexts[0].systemPrompt,
      ),
    ).toBe(true);
    expect(signals[0]).toBe(signals[1]);
    expect(signals[0]).not.toBe(signals[2]);
    expect(fileDuringRun.trim().split("\n")).toHaveLength(1);
    expect(events.filter((type) => type === "agent_settled")).toHaveLength(2);
    expect(session.state.messages).toHaveLength(6);
    expect(session.state.draft).toBeUndefined();
    expect(session.state.listenerErrors).toEqual([]);
    expect((await SessionManager.open(manager.sessionFile!)).messages).toEqual(
      session.state.messages,
    );
  } finally {
    session.dispose();
    await rm(dir, { recursive: true, force: true });
  }
});

test("model configuration locks against prompts and preserves selection on authentication failure", async () => {
  let release!: () => void;
  let checking = false;
  const requested: string[] = [];
  const { session } = await setup(
    runtime(
      (selected) => {
        requested.push(selected.id);
        return stream();
      },
      async (selected) => {
        if (selected.id === "invalid") throw new Error("Missing auth");

        if (selected.id === "other" && !checking) {
          checking = true;
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
      },
    ),
  );

  await expect(session.setModel({ ...model, id: "invalid" })).rejects.toThrow("Missing auth");
  expect(session.model.id).toBe("test");

  const changing = session.setModel({ ...model, id: "other" });

  expect(checking).toBe(true);
  await expect(session.prompt("busy")).rejects.toThrow("already running");
  expect(() => session.dispose()).toThrow("already running");
  release();
  await changing;

  expect(session.sessionManager.getHeader().model?.id).toBe("other");
  await expect(session.setModel(model, { persist: true })).rejects.toThrow("not supported");
  await session.prompt("next");
  expect(requested).toEqual(["other"]);
  session.dispose();
  await expect(session.prompt("disposed")).rejects.toThrow("disposed");
});

test("cancelling asynchronous preflight prevents model execution and emits one settled event", async () => {
  let checks = 0;
  let release!: () => void;
  let requests = 0;
  const { session } = await setup(
    runtime(
      () => {
        requests++;
        return stream();
      },
      async () => {
        if (++checks > 1)
          await new Promise<void>((resolve) => {
            release = resolve;
          });
      },
    ),
  );
  let settled = 0;

  session.subscribe((event) => {
    if (event.type === "agent_settled") settled++;
  });

  const running = session.prompt("wait");
  const rejected = running.catch((error: Error) => error.message);
  const aborting = session.abort();

  await expect(session.prompt("busy")).rejects.toThrow("already running");
  release();
  await aborting;

  expect(await rejected).toBe("Run cancelled");
  expect(requests).toBe(0);
  expect(settled).toBe(1);
  expect(session.state.messages).toEqual([]);
  expect(session.state.outcome).toBe("cancelled");
  session.dispose();
});

test.each(["error", "aborted", "length"] as const)(
  "model %s is saved and rejected; listener errors do not stop cleanup",
  async (reason) => {
    let requests = 0;
    const { session } = await setup(
      runtime(() => stream(++requests === 1 ? answer(undefined, reason) : answer())),
    );

    session.subscribe(() => {
      throw new Error("UI failed");
    });
    session.subscribe(async () => {
      throw new Error("Async UI failed");
    });

    await expect(session.prompt("first")).rejects.toThrow();
    expect(session.state.messages).toHaveLength(2);
    expect(session.isRunning).toBe(false);
    expect(session.state.listenerErrors.length).toBeGreaterThan(0);
    await session.prompt("continue");
    expect(session.state.messages).toHaveLength(4);
    session.dispose();
  },
);

test("save failure retains pending history, blocks new work and flush never reruns tools", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-save-"));
  const store = join(dir, "sessions");
  const manager = await SessionManager.create(dir, store);
  let requests = 0;
  const { session } = await setup(
    runtime(() => {
      requests++;
      return stream();
    }),
    dir,
    manager,
  );
  const before = await Bun.file(manager.sessionFile!).text();

  await rename(store, store + "-old");
  await Bun.write(store, "blocks directory");

  try {
    await expect(session.prompt("save")).rejects.toThrow();
    expect(session.state.hasPendingSave).toBe(true);
    expect(session.state.messages).toHaveLength(2);
    expect(await Bun.file(join(store + "-old", manager.getSessionId()) + ".jsonl").text()).toBe(
      before,
    );
    await expect(session.prompt("blocked")).rejects.toThrow("Pending session save");
    expect(() => session.dispose()).toThrow("Pending session save");
    await rm(store);
    await rename(store + "-old", store);
    await session.flush();
    expect(requests).toBe(1);
    expect(session.state.hasPendingSave).toBe(false);
    expect((await SessionManager.open(manager.sessionFile!)).messages).toHaveLength(2);
    session.dispose();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("cancelled tool batches save matching results and a fresh Agent resumes without replay", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-cancel-tools-"));
  const manager = await SessionManager.create(dir, join(dir, "sessions"));
  let requests = 0;
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const { session } = await setup(
    runtime((_model, context) => {
      if (++requests === 1)
        return stream(
          answer(
            [
              { type: "toolCall", id: "wait", name: "bash", arguments: { command: "sleep 20" } },
              {
                type: "toolCall",
                id: "skip",
                name: "write",
                arguments: { path: "never.txt", content: "never" },
              },
            ],
            "toolUse",
          ),
        );

      expect(
        context.messages
          .filter((message) => message.role === "toolResult")
          .map((message) => [message.toolCallId, message.isError]),
      ).toEqual([
        ["wait", true],
        ["skip", true],
      ]);

      return stream();
    }),
    dir,
    manager,
  );

  session.subscribe((event) => {
    if (event.type === "tool_execution_start") started();
  });

  try {
    const rejected = session.prompt("tools").catch((error: Error) => error.message);

    await ready;
    await session.abort();
    expect(await rejected).toContain("cancel");
    expect(requests).toBe(1);
    expect(await Bun.file(join(dir, "never.txt")).exists()).toBe(false);
    expect((await SessionManager.open(manager.sessionFile!)).messages).toHaveLength(4);
    await session.prompt("resume");
    expect(requests).toBe(2);
  } finally {
    await session.abort();
    session.dispose();
    await rm(dir, { recursive: true, force: true });
  }
});

test("execution and storage failures are both reported without losing the snapshot", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-both-errors-"));
  const store = join(dir, "sessions");
  const manager = await SessionManager.create(dir, store);
  const { session } = await setup(
    runtime(() => stream(answer(undefined, "length"))),
    dir,
    manager,
  );

  await rename(store, store + "-old");
  await Bun.write(store, "blocks directory");

  try {
    const failure = await session.prompt("fail").catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors).toHaveLength(2);
    expect((failure as AggregateError).message).toContain("truncated");
    expect(session.state.hasPendingSave).toBe(true);
    await rm(store);
    await rename(store + "-old", store);
    await session.flush();
    expect((await SessionManager.open(manager.sessionFile!)).messages).toHaveLength(2);
    session.dispose();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
