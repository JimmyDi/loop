import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { AssistantMessage, Context, Message, Model } from "@earendil-works/pi-ai";
import { expect, test } from "vitest";

import { AgentSession } from "../agent-session";
import { ContextBudgetExceededError } from "../context-budget";
import type { ModelRuntime } from "../model-runtime";
import { SessionManager } from "../session-manager";
import { SkillManager } from "../skills/skill-manager";
import type { SessionEvent } from "../types/session";

const model: Model<"openai-completions"> = {
  id: "fixture",
  name: "Fixture",
  provider: "fixture",
  api: "openai-completions",
  baseUrl: "https://example.invalid",
  input: ["text"],
  reasoning: false,
  contextWindow: 32000,
  maxTokens: 1024,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
};

const user = (length: number, timestamp = 1): Message => ({
  role: "user",
  content: "x".repeat(length),
  timestamp,
});

const answer = (text = "Complete", content?: AssistantMessage["content"]): AssistantMessage => ({
  role: "assistant",
  content: content ?? [{ type: "text", text }],
  stopReason: content ? "toolUse" : "stop",
  api: model.api,
  provider: model.provider,
  model: model.id,
  timestamp: 1,
  usage: {
    input: 100,
    output: 10,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 110,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
});

const stream = (message = answer()) => {
  const native = createAssistantMessageEventStream();
  native.push({ type: "done", reason: message.stopReason as "stop" | "toolUse", message });
  native.end();
  return native;
};

const runtime = (streamSimple: ModelRuntime["streamSimple"]): ModelRuntime => ({
  getModel: () => model,
  getModels: () => [model],
  checkModel: async () => {},
  streamSimple,
});

const isSummary = (context: Context) =>
  context.systemPrompt?.startsWith("Summarize the conversation");

test("pressure compacts before dispatch, atomically preserves originals and restores projection", async () => {
  const root = await mkdtemp(join(tmpdir(), "loop-auto-compact-"));
  const manager = await SessionManager.create(root, join(root, "sessions"));
  const original = [user(108000), answer("Previous result")];
  await manager.commit(original);
  const events: SessionEvent[] = [];
  const contexts: Context[] = [];
  let summaries = 0;
  const session = new AgentSession({
    model,
    sessionManager: manager,
    systemPrompt: "Current rules",
    tools: [],
    modelRuntime: runtime((_model, context) => {
      if (isSummary(context)) {
        summaries++;
        expect(context.tools).toEqual([]);
        return stream(answer("Goal: continue. Completed: previous work."));
      }
      contexts.push(structuredClone(context));
      return stream();
    }),
  });
  session.subscribe((event) => {
    events.push(event);
  });
  try {
    await session.prompt("Continue reviewing");
    expect(summaries).toBe(1);
    expect(contexts).toHaveLength(1);
    expect(JSON.stringify(contexts[0])).toContain("<summary>");
    expect(JSON.stringify(contexts[0])).not.toContain("x".repeat(1000));
    expect(session.state.messages.slice(0, 2)).toEqual(original);
    expect(manager.messages).toHaveLength(4);
    expect(manager.getCompactions()).toHaveLength(1);
    expect(events.filter((event) => event.type === "compaction_start")).toHaveLength(1);
    expect(events.filter((event) => event.type === "compaction_end")).toHaveLength(1);
    expect(session.state.activeCompaction).toBeUndefined();
    expect(session.state.contextBudget?.fits).toBe(true);
    expect(session.modelInputProjection?.sources[0]?.type).toBe("compaction");
    expect(JSON.stringify(events.find((event) => event.type === "compaction_end"))).not.toContain(
      "Goal: continue",
    );
    const reopened = await SessionManager.open(manager.sessionFile!);
    expect(reopened.messages).toEqual(manager.messages);
    const restored = new AgentSession({
      model,
      sessionManager: reopened,
      systemPrompt: "Current rules",
      tools: [],
      modelRuntime: runtime((_model, context) => {
        expect(isSummary(context)).toBeFalsy();
        expect(JSON.stringify(context)).toContain("Goal: continue");
        return stream();
      }),
    });
    await restored.prompt("Continue after restart");
    restored.dispose();
  } finally {
    session.dispose();
    await rm(root, { recursive: true, force: true });
  }
});

test("tool continuations compact live results without repeating tools or moving source indexes", async () => {
  const manager = SessionManager.inMemory();
  await manager.commit([user(55000), answer(), user(45000, 2), answer()]);
  let main = 0;
  let summaries = 0;
  let executions = 0;
  const session = new AgentSession({
    model,
    sessionManager: manager,
    systemPrompt: "Rules",
    tools: [
      {
        name: "read",
        description: "Read fixture",
        parameters: { type: "object" },
        execute: () => {
          executions++;
          return [{ type: "text", text: "result " + "r".repeat(8000) }];
        },
      },
    ],
    modelRuntime: runtime((_model, context) => {
      if (isSummary(context)) {
        summaries++;
        return stream(answer("Completed earlier work; current task continues."));
      }
      main++;
      if (main === 1)
        return stream(
          answer("", [{ type: "toolCall", id: "read-once", name: "read", arguments: {} }]),
        );
      expect(context.messages.map((message) => message.role)).toEqual([
        "user",
        "user",
        "assistant",
        "toolResult",
      ]);
      expect(context.messages.at(-1)?.content).toEqual([
        { type: "text", text: "result " + "r".repeat(8000) },
      ]);
      return stream();
    }),
  });
  try {
    await session.prompt("Read the fixture");
    expect([main, summaries, executions]).toEqual([2, 1, 1]);
    expect(manager.messages).toHaveLength(8);
    expect(manager.getCompactions()[0]?.historyMessageCount).toBe(7);
    expect(
      session.modelInputProjection?.sources.slice(1).map((source) => source.messageIndex),
    ).toEqual([4, 5, 6]);
  } finally {
    session.dispose();
  }
});

test("later prompts merge the previous summary and advance original history boundaries", async () => {
  const manager = SessionManager.inMemory();
  await manager.commit([user(108000), answer()]);
  let summaries = 0;
  const session = new AgentSession({
    model,
    sessionManager: manager,
    systemPrompt: "Rules",
    tools: [],
    modelRuntime: runtime((_model, context) => {
      if (isSummary(context)) {
        summaries++;
        if (summaries === 2) expect(JSON.stringify(context.messages)).toContain("First checkpoint");
        return stream(answer(summaries === 1 ? "First checkpoint" : "Merged checkpoint"));
      }
      return stream();
    }),
  });
  try {
    await session.prompt("q".repeat(108000));
    await session.prompt("Continue");
    expect(summaries).toBe(2);
    expect(manager.getCompactions().map((entry) => entry.firstKeptMessageIndex)).toEqual([2, 4]);
    expect(manager.messages).toHaveLength(6);
    expect(session.modelInputProjection?.sources[0]).toMatchObject({
      type: "compaction",
      summarizedBefore: 4,
    });
    expect(session.state.contextBudget?.fits).toBe(true);
  } finally {
    session.dispose();
  }
});

test("one emergency pass lowers retention only when the first summary remains over budget", async () => {
  const manager = SessionManager.inMemory();
  await manager.commit([user(40000), answer(), user(16000, 2), answer()]);
  let summaries = 0;
  const session = new AgentSession({
    model,
    sessionManager: manager,
    systemPrompt: "s".repeat(100000),
    tools: [],
    modelRuntime: runtime((_model, context) => {
      if (isSummary(context)) {
        summaries++;
        return stream(answer("Prior progress"));
      }
      return stream();
    }),
  });
  try {
    await session.prompt("q".repeat(4000));
    expect(summaries).toBe(2);
    expect(manager.getCompactions().map((entry) => entry.firstKeptMessageIndex)).toEqual([2, 4]);
    expect(session.state.contextBudget?.fits).toBe(true);
  } finally {
    session.dispose();
  }
});

test.each([false, true])(
  "failed summaries continue only below the hard limit (overflow=%s)",
  async (overflow) => {
    const manager = SessionManager.inMemory();
    await manager.commit([user(overflow ? 120000 : 108000), answer()]);
    let main = 0;
    const events: SessionEvent[] = [];
    const session = new AgentSession({
      model,
      sessionManager: manager,
      systemPrompt: "Rules",
      tools: [],
      modelRuntime: runtime((_model, context) => {
        if (isSummary(context)) throw new Error("Summary unavailable");
        main++;
        return stream();
      }),
    });
    session.subscribe((event) => {
      events.push(event);
    });
    try {
      if (overflow)
        await expect(session.prompt("Continue")).rejects.toBeInstanceOf(ContextBudgetExceededError);
      else await session.prompt("Continue");
      expect(main).toBe(overflow ? 0 : 1);
      expect(manager.getCompactions()).toEqual([]);
      expect(manager.messages[2]?.content).toBe("Continue");
      expect(session.state.activeCompaction).toBeUndefined();
      if (!overflow)
        expect(events.find((event) => event.type === "compaction_end")).toMatchObject({
          error: "Summary unavailable",
        });
    } finally {
      session.dispose();
    }
  },
);

test("cancelling automatic compaction saves the accepted prompt without a checkpoint", async () => {
  const manager = SessionManager.inMemory();
  await manager.commit([user(108000), answer()]);
  const ready = Promise.withResolvers<void>();
  let main = 0;
  const session = new AgentSession({
    model,
    sessionManager: manager,
    systemPrompt: "Rules",
    tools: [],
    modelRuntime: runtime((_model, context) => {
      if (isSummary(context)) {
        ready.resolve();
        return createAssistantMessageEventStream();
      }
      main++;
      return stream();
    }),
  });
  const pending = session.prompt("Continue");
  const rejected = expect(pending).rejects.toThrow("cancelled");
  await ready.promise;
  expect(session.state.activeCompaction?.startedAt).toEqual(expect.any(Number));
  await session.abort();
  await rejected;
  expect(main).toBe(0);
  expect(manager.messages).toHaveLength(3);
  expect(manager.getCompactions()).toEqual([]);
  expect(session.state.outcome).toBe("cancelled");
  session.dispose();
});

test("save failure keeps the live history and checkpoint pending; flush never regenerates", async () => {
  const root = await mkdtemp(join(tmpdir(), "loop-auto-save-"));
  const directory = join(root, "sessions");
  const manager = await SessionManager.create(root, directory);
  await manager.commit([user(108000), answer()]);
  let summaries = 0;
  const session = new AgentSession({
    model,
    sessionManager: manager,
    systemPrompt: "Rules",
    tools: [],
    modelRuntime: runtime((_model, context) => {
      if (isSummary(context)) {
        summaries++;
        return stream(answer("Saved progress"));
      }
      throw new Error("Must not dispatch after failed save");
    }),
  });
  const previous = await readFile(manager.sessionFile!, "utf8");
  await rename(directory, join(root, "saved"));
  await writeFile(directory, "Blocked storage fixture");
  try {
    await expect(session.prompt("Continue")).rejects.toThrow();
    expect(manager.hasPendingSave).toBe(true);
    expect(manager.messages).toHaveLength(3);
    expect(manager.getCompactions()).toHaveLength(1);
    await rm(directory);
    await rename(join(root, "saved"), directory);
    expect(await readFile(manager.sessionFile!, "utf8")).toBe(previous);
    await session.flush();
    expect(summaries).toBe(1);
    const restored = await SessionManager.open(manager.sessionFile!);
    expect(restored.messages).toEqual(manager.messages);
    expect(restored.getCompactions()).toEqual(manager.getCompactions());
  } finally {
    session.dispose();
    await rm(root, { recursive: true, force: true });
  }
});

test("cancellation during checkpoint persistence waits before releasing the session lock", async () => {
  const manager = SessionManager.inMemory();
  await manager.commit([user(108000), answer()]);
  const saving = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const commit = manager.commit.bind(manager);
  let delayed = false;
  manager.commit = async (...args) => {
    if (args[3]?.compactions && !delayed) {
      delayed = true;
      saving.resolve();
      await release.promise;
    }
    await commit(...args);
  };
  let main = 0;
  const session = new AgentSession({
    model,
    sessionManager: manager,
    systemPrompt: "Rules",
    tools: [],
    modelRuntime: runtime((_model, context) => {
      if (isSummary(context)) return stream(answer("Saved progress"));
      main++;
      return stream();
    }),
  });
  const pending = session.prompt("Continue");
  const rejected = expect(pending).rejects.toThrow("cancelled");
  try {
    await saving.promise;
    let settled = false;
    const aborting = session.abort().then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(session.isRunning).toBe(true);
    await expect(session.prompt("Overlapping request")).rejects.toThrow("already running");
    release.resolve();
    await aborting;
    await rejected;
    expect(main).toBe(0);
    expect(manager.messages).toHaveLength(3);
    expect(manager.getCompactions()).toHaveLength(1);
    expect(manager.hasPendingSave).toBe(false);
    expect(session.state.outcome).toBe("cancelled");
  } finally {
    release.resolve();
    await session.abort();
    session.dispose();
  }
});

test("newly selected Skill expansions influence pressure and remain mapped after compaction", async () => {
  const root = await mkdtemp(join(tmpdir(), "loop-auto-skill-"));
  const skills = new SkillManager(join(root, "personal"), join(root, "shared"));
  let session: AgentSession | undefined;
  try {
    const directory = join(root, ".agents/skills/example");
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, "SKILL.md"),
      "---\nname: example\ndescription: Review source\n---\n" + "s".repeat(12000),
    );
    await skills.refresh(root);
    const skill = skills.view(root).skills[0]!;
    const manager = await SessionManager.create(root, join(root, "sessions"));
    await manager.commit([user(96000), answer()]);
    let summaries = 0;
    session = new AgentSession({
      model,
      sessionManager: manager,
      skillManager: skills,
      systemPrompt: "Rules",
      tools: [],
      modelRuntime: runtime((_model, context) => {
        if (isSummary(context)) {
          summaries++;
          expect(JSON.stringify(context.messages)).not.toContain("s".repeat(1000));
          return stream(answer("Prior work completed"));
        }
        expect(JSON.stringify(context.messages)).toContain("s".repeat(1000));
        expect(JSON.stringify(context.messages)).toContain("Review this");
        return stream();
      }),
    });
    await session.prompt("Review this", { skills: [skill.id] });
    expect(summaries).toBe(1);
    expect(manager.messages[2]?.content).toBe("Review this");
    expect(session.modelInputProjection?.skillExpansions?.[0]?.messageIndex).toBe(2);
    expect(manager.getRuntimeContexts()[0]?.skills?.[0]?.id).toBe(skill.id);
    const restored = await SessionManager.open(manager.sessionFile!);
    expect(restored.getRuntimeContexts()).toEqual(manager.getRuntimeContexts());
  } finally {
    session?.dispose();
    await skills.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("unhelpful summaries do not create checkpoints or cause immediate repeated attempts", async () => {
  const manager = SessionManager.inMemory();
  await manager.commit([user(108000), answer()]);
  let summaries = 0;
  let main = 0;
  const session = new AgentSession({
    model,
    sessionManager: manager,
    systemPrompt: "Rules",
    tools: [
      {
        name: "read",
        description: "Read",
        parameters: { type: "object" },
        execute: () => [{ type: "text", text: "Small result" }],
      },
    ],
    modelRuntime: runtime((_model, context) => {
      if (isSummary(context)) {
        summaries++;
        return stream(answer("s".repeat(109000)));
      }
      main++;
      return stream(
        main <= 3
          ? answer("", [
              {
                type: "toolCall",
                id: "read-" + main,
                name: "read",
                arguments: {},
              },
            ])
          : answer(),
      );
    }),
  });
  try {
    await session.prompt("Continue");
    expect(summaries).toBe(2);
    expect(main).toBe(4);
    expect(manager.getCompactions()).toEqual([]);
  } finally {
    session.dispose();
  }
});

test("oversized newest turns remain intact and fail without rerunning completed tools", async () => {
  const manager = SessionManager.inMemory();
  await manager.commit([user(5000), answer()]);
  let summaries = 0;
  let main = 0;
  let tools = 0;
  const session = new AgentSession({
    model,
    sessionManager: manager,
    systemPrompt: "Rules",
    tools: [
      {
        name: "read",
        description: "Read",
        parameters: { type: "object" },
        execute: () => {
          tools++;
          return [{ type: "text", text: "r".repeat(120000) }];
        },
      },
    ],
    modelRuntime: runtime((_model, context) => {
      if (isSummary(context)) {
        summaries++;
        return stream(answer("Old task"));
      }
      main++;
      return stream(
        answer("", [{ type: "toolCall", id: "read-once", name: "read", arguments: {} }]),
      );
    }),
  });
  try {
    await expect(session.prompt("Read")).rejects.toBeInstanceOf(ContextBudgetExceededError);
    expect([main, summaries, tools]).toEqual([1, 1, 1]);
    expect(manager.messages.at(-1)?.role).toBe("toolResult");
    expect(manager.getCompactions()).toHaveLength(1);
    expect(session.state.contextBudget?.fits).toBe(false);
  } finally {
    session.dispose();
  }
});
