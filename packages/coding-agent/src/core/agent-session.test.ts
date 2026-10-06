import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { vi, expect, test } from "vitest";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { Api, AssistantMessage, Context, Model } from "@earendil-works/pi-ai";

import { createAgentSession } from "./sdk";
import type { ModelRuntime } from "./model-runtime";
import { SessionManager } from "./session-manager";
import { SettingsManager } from "./settings-manager";
import { AgentSession } from "./agent-session";
import { AgentSessionRuntime } from "./agent-session-runtime";
import type { ApprovalRequest, ApprovalResult } from "./approvals/types";
import { ContextBudgetExceededError } from "./context-budget";
import type { ContextBudget } from "./context-budget";

test("approval APIs expose pending snapshots, isolate listeners and preserve managed authority", async () => {
  const options = {
    model,
    modelRuntime: runtime(() => stream()),
    noContextFiles: true,
    settingsManager: SettingsManager.inMemory(),
    sessionManager: SessionManager.inMemory(),
    tools: [],
  };
  const { session } = await createAgentSession(options);
  const input = { toolName: "write", toolCallId: "test-call", reason: "Review operation" };
  const seen: string[] = [];
  const respond = (request: ApprovalRequest) =>
    session.respondToApproval({ ...request, decision: "allowed-once" });
  session.subscribe((event) => {
    if (event.type === "approval_requested") {
      Object.assign(event.request, { reason: "modified observer snapshot" });
      throw new Error("observer failed");
    }
  });
  session.subscribe(async (event) => {
    if (event.type === "approval_requested") throw new Error("async observer failed");
  });
  session.subscribe((event) => {
    seen.push(event.type);
  });
  try {
    expect((await session.requestApproval(input)).outcome).toBe("unavailable");
    expect(session.state.listenerErrors).toContain("observer failed");
    expect(session.state.listenerErrors).toContain("async observer failed");
    const detach = session.registerApprovalHandler(() => {});
    const waiting = session.requestApproval(input);
    const request = session.state.pendingApprovals![0]!;
    expect(request.reason).toBe(input.reason);
    Object.assign(request, { reason: "modified state snapshot" });
    expect(session.state.pendingApprovals![0]!.reason).toBe(input.reason);
    await expect(session.prompt("blocked")).rejects.toThrow("pending approvals");
    await expect(session.setPermissionPreset("workspace-write")).rejects.toThrow(
      "pending approvals",
    );
    await expect(session.setModel(model)).rejects.toThrow("pending approvals");
    expect(respond(request)).toBe(true);
    expect((await waiting).outcome).toBe("allowed-once");
    expect(respond(request)).toBe(false);
    expect(session.state.pendingApprovals).toEqual([]);
    expect(session.permissionPreset).toBe("read-only");
    expect(session.sessionManager.getHeader()).not.toHaveProperty("pendingApprovals");
    expect(session.state.messages).toEqual([]);
    detach();
    session.registerApprovalHandler((next) => {
      respond(next);
    });
    seen.length = 0;
    expect((await session.requestApproval(input)).outcome).toBe("allowed-once");
    expect(seen).toEqual(["approval_requested", "approval_resolved"]);
    await session.setPermissionPreset("danger-full-access");
    expect((await session.requestApproval(input)).outcome).toBe("rejected");
  } finally {
    await session.abort();
    session.dispose();
  }
});

test("run abort cancels approval waits and normal completion drains unawaited requests", async () => {
  const input = { toolName: "test-operation", toolCallId: "test-call", reason: "Review operation" };
  for (const cancel of [true, false]) {
    const ready = Promise.withResolvers<ApprovalRequest>();
    let pending!: Promise<ApprovalResult>;
    let calls = 0;
    const session = new AgentSession({
      model,
      systemPrompt: "Test",
      sessionManager: SessionManager.inMemory(),
      modelRuntime: runtime(() =>
        stream(
          ++calls === 1
            ? answer(
                [{ type: "toolCall", name: input.toolName, id: input.toolCallId, arguments: {} }],
                "toolUse",
              )
            : answer(),
        ),
      ),
      tools: [
        {
          name: input.toolName,
          description: "Synthetic operation",
          parameters: { type: "object", properties: {} },
          execute: async () => {
            pending = session.requestApproval(input);
            if (cancel) await pending;
            return [{ type: "text", text: "No action performed" }];
          },
        },
      ],
    });
    session.registerApprovalHandler((request) => {
      ready.resolve(request);
    });
    const running = session.prompt("test").catch((error: unknown) => error);
    try {
      const request = await ready.promise;
      if (cancel) await session.abort();
      await running;
      expect((await pending).outcome).toBe("cancelled");
      expect(session.respondToApproval({ ...request, decision: "allowed-once" })).toBe(false);
      expect(session.state.pendingApprovals).toEqual([]);
      expect(session.state.outcome).toBe(cancel ? "cancelled" : "success");
      expect(session.state.isRunning).toBe(false);
    } finally {
      await session.abort();
      session.dispose();
    }
  }
});

test("session replacement requires approval cancellation and never carries decisions or handlers", async () => {
  const factory = async ({ sessionManager }: { sessionManager: SessionManager }) => ({
    session: new AgentSession({
      model,
      modelRuntime: runtime(() => stream()),
      tools: [],
      systemPrompt: "Test",
      sessionManager,
    }),
  });
  const { session } = await factory({ sessionManager: SessionManager.inMemory() });
  const sessionRuntime = new AgentSessionRuntime(session, factory);
  const input = { toolName: "write", toolCallId: "test-call", reason: "Review operation" };
  session.registerApprovalHandler(() => {});
  const waiting = session.requestApproval(input);
  const request = session.state.pendingApprovals![0]!;
  await expect(sessionRuntime.newSession()).rejects.toThrow("pending approvals");
  await session.abort();
  expect((await waiting).outcome).toBe("cancelled");
  await sessionRuntime.newSession();
  expect(sessionRuntime.session.state.pendingApprovals).toEqual([]);
  expect(sessionRuntime.session.respondToApproval({ ...request, decision: "allowed-once" })).toBe(
    false,
  );
  expect((await sessionRuntime.session.requestApproval(input)).outcome).toBe("unavailable");
  await expect(session.requestApproval(input)).rejects.toThrow("disposed");
  expect(() => session.registerApprovalHandler(() => {})).toThrow("disposed");
  sessionRuntime.session.registerApprovalHandler(() => {});
  const closing = sessionRuntime.session.requestApproval(input);
  await sessionRuntime.dispose();
  expect((await closing).outcome).toBe("cancelled");
  expect(sessionRuntime.session.state.pendingApprovals).toEqual([]);
});

test("disposing an idle session cancels pending approvals before clearing observers", async () => {
  const session = new AgentSession({
    model,
    modelRuntime: runtime(() => stream()),
    tools: [],
    systemPrompt: "Test",
    sessionManager: SessionManager.inMemory(),
  });
  const outcomes: string[] = [];
  session.subscribe((event) => {
    if (event.type === "approval_resolved") outcomes.push(event.result.outcome);
  });
  session.registerApprovalHandler(() => {});
  const pending = session.requestApproval({
    toolName: "write",
    toolCallId: "test",
    reason: "Review",
  });
  session.dispose();
  expect((await pending).outcome).toBe("cancelled");
  expect(outcomes).toEqual(["cancelled"]);
  expect(session.state.pendingApprovals).toEqual([]);
});

test("session presets enforce built-in tools, persist, reject busy changes and restore saved permissions", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".session-permission-test-"));
  const manager = await SessionManager.create(root, join(root, "storage"));
  let calls = 0;
  const policies: string[] = [];
  const contexts: Context[] = [];
  const modelRuntime = runtime((_model, context) => {
    policies.push(context.systemPrompt ?? "");
    contexts.push(structuredClone(context));
    return stream(
      ++calls % 2 === 1
        ? answer(
            [
              {
                type: "toolCall",
                id: "write-" + calls,
                name: "write",
                arguments: { path: "file", content: "value" },
              },
            ],
            "toolUse",
          )
        : answer(),
    );
  });
  const options = {
    model,
    modelRuntime,
    noContextFiles: true,
    sessionManager: manager,
    agentDir: join(root, "agent-data"),
    settingsManager: SettingsManager.inMemory(),
  };
  try {
    const { session } = await createAgentSession(options);
    expect(session.permissionPreset).toBe("read-only");
    expect(session.state.permissionPreset).toBe("read-only");
    expect(manager.getHeader().permissionPreset).toBe("read-only");
    let approvalDeliveries = 0;
    session.registerApprovalHandler((request) => {
      approvalDeliveries++;
      session.respondToApproval({ ...request, decision: "rejected" });
    });
    const denied = session.prompt("Try write");
    await expect(session.setPermissionPreset("danger-full-access")).rejects.toThrow(
      "already running",
    );
    await denied;
    expect(approvalDeliveries).toBe(1);
    expect(await existsSync(join(root, "file"))).toBe(false);
    expect(session.state.messages.find((message) => message.role === "toolResult")).toMatchObject({
      isError: true,
    });
    const events: string[] = [];
    session.subscribe((event) => {
      events.push(event.type);
    });
    await session.setPermissionPreset("workspace-write");
    expect(events).toEqual(["permission_changed"]);
    await session.prompt("Write allowed");
    expect(await readFile(join(root, "file"), "utf8")).toBe("value");
    expect(new Set(policies).size).toBe(1);
    expect(policies[0]).not.toContain("Current permission preset:");
    expect(contexts[0]?.messages[1]?.content).toContain("Current permission preset: read-only");
    expect(contexts[2]?.messages.at(-1)?.content).toContain(
      "Current permission preset: workspace-write",
    );
    expect(contexts[2]?.messages.slice(0, contexts[1]?.messages.length)).toEqual(
      contexts[1]?.messages,
    );
    expect(contexts[1]?.messages.slice(0, 2)).toEqual(contexts[0]?.messages);
    expect(manager.getRuntimeContexts()).toHaveLength(2);
    expect(JSON.stringify(session.state.messages)).not.toContain("Current permission preset:");
    session.dispose();
    const { session: reopened } = await createAgentSession({
      ...options,
      sessionManager: await SessionManager.open(manager.sessionFile!),
    });
    expect(reopened.permissionPreset).toBe("workspace-write");
    await reopened.prompt("Write after restore");
    expect(reopened.sessionManager.getRuntimeContexts()).toEqual(manager.getRuntimeContexts());
    expect(contexts[4]?.messages.slice(0, contexts[3]?.messages.length)).toEqual(
      contexts[3]?.messages,
    );
    expect(policies[4]).toBe(policies[0]);
    reopened.dispose();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reopening storage restores no pending approval, decision or handler", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".approval-restore-test-"));
  const manager = await SessionManager.create(root, join(root, "storage"));
  const options = {
    model,
    modelRuntime: runtime(() => stream()),
    noContextFiles: true,
    agentDir: join(root, "agent-data"),
    settingsManager: SettingsManager.inMemory(),
    tools: [],
  };
  const { session } = await createAgentSession({ ...options, sessionManager: manager });
  const input = { toolName: "write", toolCallId: "test-call", reason: "Review operation" };
  try {
    session.registerApprovalHandler(() => {});
    const waiting = session.requestApproval(input);
    const request = session.state.pendingApprovals![0]!;
    const { session: restored } = await createAgentSession({
      ...options,
      sessionManager: await SessionManager.open(manager.sessionFile!),
    });
    try {
      expect(restored.sessionId).toBe(session.sessionId);
      expect(restored.state.pendingApprovals).toEqual([]);
      expect(restored.respondToApproval({ ...request, decision: "allowed-once" })).toBe(false);
      expect((await restored.requestApproval(input)).outcome).toBe("unavailable");
      const stored = await readFile(manager.sessionFile!, "utf8");
      expect(stored).not.toContain(request.requestId);
      expect(stored).not.toContain(input.reason);
      expect(session.respondToApproval({ ...request, decision: "allowed-once" })).toBe(true);
      expect((await waiting).outcome).toBe("allowed-once");
      expect(restored.permissionPreset).toBe("read-only");
    } finally {
      restored.dispose();
    }
  } finally {
    await session.abort();
    session.dispose();
    await rm(root, { recursive: true, force: true });
  }
});

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

test("runtime context survives filtered failures and stays out of titles, images and user events", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".runtime-context-test-"));
  const manager = SessionManager.inMemory(root);
  const contexts: Context[] = [];
  const titleContexts: Context[] = [];
  const visibleUsers: unknown[] = [];
  const selected = { ...model, input: ["text", "image"] as Array<"text" | "image"> };
  const { session } = await createAgentSession({
    cwd: root,
    model: selected,
    modelRuntime: runtime((_model, context) => {
      if (context.systemPrompt?.includes("Name this coding conversation")) {
        titleContexts.push(structuredClone(context));
        return stream(answer());
      }
      contexts.push(structuredClone(context));
      if (contexts.length === 1) {
        return stream({ ...answer(undefined, "error"), errorMessage: "Provider failed" });
      }
      return stream();
    }),
    settingsManager: SettingsManager.inMemory(),
    sessionManager: manager,
    noContextFiles: true,
    systemPrompt: "Custom base",
    title: { mode: "first-prompt" },
  });
  session.subscribe((event) => {
    if (event.type === "message_end" && event.message.role === "user") {
      visibleUsers.push(event.message.content);
    }
  });
  try {
    await expect(session.prompt("First task")).rejects.toThrow("Provider failed");
    await session.waitForTitle();
    await session.setPermissionPreset("workspace-write");
    const content = [
      { type: "text" as const, text: "Explain this image" },
      { type: "image" as const, data: "AAAA", mimeType: "image/png" },
    ];
    await session.prompt(content);
    expect(contexts[1]?.messages).toHaveLength(4);
    expect(contexts[1]?.messages[0]?.content).toBe("First task");
    expect(contexts[1]?.messages[1]).toEqual(contexts[0]?.messages[1]);
    expect(contexts[1]?.messages[2]?.content).toEqual(content);
    expect(contexts[1]?.messages[3]?.content).toContain("workspace-write");
    expect(contexts[1]?.systemPrompt).toBe(contexts[0]?.systemPrompt);
    expect(visibleUsers).toEqual(["First task", content]);
    expect(session.state.messages).toHaveLength(4);
    expect(manager.getRuntimeContexts().map((entry) => entry.userTurn)).toEqual([0, 1]);
    expect(titleContexts).toHaveLength(1);
    expect(JSON.stringify(titleContexts)).not.toContain("Loop runtime context");
    expect(session.state.title?.messageIndices).toEqual([0]);
  } finally {
    await session.abort();
    session.dispose();
    await rm(root, { recursive: true, force: true });
  }
});

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

test("failed and cancelled prompts retain runtime context after model use, excluding preflight failures", async () => {
  let rejectPreflight = false;
  let started = () => {};
  const startedPromise = new Promise<void>((resolve) => {
    started = resolve;
  });
  let failModel = true;
  const { session } = await setup(
    runtime(
      () => {
        if (failModel) {
          throw new Error("Model failed");
        }
        started();
        return createAssistantMessageEventStream();
      },
      async () => {
        if (rejectPreflight) throw new Error("Preflight failed");
      },
    ),
  );
  try {
    rejectPreflight = true;
    await expect(session.prompt("Preflight")).rejects.toThrow("Preflight failed");
    expect(session.sessionManager.getRuntimeContexts()).toEqual([]);
    expect(session.state.promptTimings).toEqual([]);
    rejectPreflight = false;
    await expect(session.prompt("Failure")).rejects.toThrow("Model failed");
    expect(session.state.promptTimings?.[0]?.finishedAt).toBeTypeOf("number");
    expect(session.sessionManager.getRuntimeContexts()).toHaveLength(1);
    failModel = false;
    const pending = session.prompt("Cancel").catch(() => {});
    await startedPromise;
    await session.abort();
    await pending;
    expect(session.sessionManager.getRuntimeContexts()).toHaveLength(1);
    expect(session.state.outcome).toBe("cancelled");
    expect(session.state.promptTimings?.at(-1)?.finishedAt).toBeTypeOf("number");
  } finally {
    session.dispose();
  }
});

test("oversized prompts reject before dispatch and preserve full input without a host snapshot", async () => {
  let calls = 0;
  const content = "large".repeat(10000);
  const { session } = await setup(
    runtime((_model, context) => {
      calls++;
      expect(context.messages[0]?.content).toBe(content);
      return stream({ ...answer(undefined, "error"), errorMessage: "Provider context limit" });
    }),
  );
  try {
    await expect(session.prompt(content)).rejects.toBeInstanceOf(ContextBudgetExceededError);
    expect(calls).toBe(0);
    expect(session.state.messages).toHaveLength(1);
    expect(session.state.messages[0]?.content).toBe(content);
    expect(session.sessionManager.getRuntimeContexts()).toEqual([]);
    expect(session.state.contextBudget?.fits).toBe(false);
    expect(session.state.error).toContain("Context budget exceeded");
    expect(session.state.outcome).toBe("error");
    expect(session.state.isRunning).toBe(false);
  } finally {
    session.dispose();
  }
});

test("tool continuations check the complete request and recover with a larger model without replay", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-budget-"));
  const manager = await SessionManager.create(dir, join(dir, "sessions"));
  const resultText = "large tool output ".repeat(2000);
  const budgets: ContextBudget[] = [];
  const contexts: Context[] = [];
  let executions = 0;
  const toolResponse = answer(
    [
      { type: "text", text: "Read the file." },
      { type: "toolCall", id: "read-once", name: "read", arguments: {} },
    ],
    "toolUse",
  );
  toolResponse.usage = {
    input: 120,
    output: 40,
    cacheRead: 80,
    cacheWrite: 20,
    totalTokens: 260,
    reasoning: 10,
    cost: { input: 1, output: 2, cacheRead: 3, cacheWrite: 4, total: 10 },
  };
  const session = new AgentSession({
    model,
    modelRuntime: runtime((_model, context, options) => {
      contexts.push(structuredClone(context));
      expect(options?.maxTokens).toBe(model.maxTokens);
      return stream(contexts.length === 1 ? toolResponse : answer());
    }),
    sessionManager: manager,
    systemPrompt: "Test",
    tools: [
      {
        name: "read",
        description: "Read",
        parameters: { type: "object", properties: {} },
        execute: async () => {
          executions++;
          return [{ type: "text", text: resultText }];
        },
      },
    ],
  });
  session.subscribe((event) => {
    if (event.type === "context_budget") budgets.push(event.budget);
  });
  try {
    await expect(session.prompt("Read it")).rejects.toBeInstanceOf(ContextBudgetExceededError);
    expect(contexts).toHaveLength(1);
    expect(executions).toBe(1);
    expect(budgets.map((budget) => budget.fits)).toEqual([true, false]);
    expect(budgets[1]!.estimatedInputTokens).toBeGreaterThan(budgets[0]!.estimatedInputTokens);
    expect(session.state.messages).toHaveLength(3);
    const reopened = await SessionManager.open(manager.sessionFile!);
    expect(reopened.messages).toEqual(session.state.messages);
    expect(reopened.messages[1]).toEqual(toolResponse);
    expect(reopened.messages[2]?.content).toEqual([{ type: "text", text: resultText }]);
    await session.setModel({ ...model, contextWindow: 32000 });
    expect(session.state.contextBudget).toBeUndefined();
    await session.prompt("Continue from the saved result");
    expect(contexts).toHaveLength(2);
    expect(contexts[1]?.messages[2]?.content).toEqual([{ type: "text", text: resultText }]);
    expect(executions).toBe(1);
    expect(session.state.contextBudget?.fits).toBe(true);
    const stateBudget = session.state.contextBudget!;
    stateBudget.estimatedInputTokens = 0;
    expect(session.state.contextBudget?.estimatedInputTokens).toBeGreaterThan(0);
  } finally {
    session.dispose();
    await rm(dir, { recursive: true, force: true });
  }
});

test("provider failures below the local estimate retain native actual usage and history", async () => {
  const response = {
    ...answer(undefined, "error"),
    errorMessage: "Provider context limit",
    usage: { ...answer().usage, input: 500, output: 20, cacheRead: 50, totalTokens: 570 },
  };
  const { session } = await setup(runtime(() => stream(response)));
  try {
    await expect(session.prompt("Short prompt")).rejects.toThrow("Provider context limit");
    expect(session.state.contextBudget?.fits).toBe(true);
    expect(session.state.messages[1]).toEqual(response);
    expect(session.sessionManager.messages[1]).toEqual(response);
  } finally {
    session.dispose();
  }
});

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

  await session.setPermissionPreset("workspace-write");

  session.subscribe((event) => {
    events.push(event.type);

    if (event.type === "message_update") {
      expect(session.state.draft).toBeDefined();
      expect(session.sessionManager.messages).toHaveLength(contexts.length < 3 ? 0 : 4);
    }
  });
  session.subscribe(async (event) => {
    if (event.type === "tool_execution_start")
      fileDuringRun = await readFile(manager.sessionFile!, "utf8");
  });

  try {
    await session.prompt("same input");
    await session.prompt("same input");

    expect(await readFile(join(dir, "config.txt"), "utf8")).toBe("saved");
    expect(contexts.map((context) => context.messages.length)).toEqual([2, 4, 6]);
    expect(contexts[1].messages[3]).toMatchObject({
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
    expect(session.state.unread).toBe(true);
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
  const before = await readFile(manager.sessionFile!, "utf8");

  await rename(store, store + "-old");
  await writeFile(store, "blocks directory");

  try {
    await expect(session.prompt("save")).rejects.toThrow();
    expect(session.state.hasPendingSave).toBe(true);
    expect(session.state.unread).toBe(true);
    expect(manager.getRuntimeContexts()).toHaveLength(1);
    expect(session.state.messages).toHaveLength(2);
    expect(await readFile(join(store + "-old", manager.getSessionId()) + ".jsonl", "utf8")).toBe(
      before,
    );
    await expect(session.prompt("blocked")).rejects.toThrow("Pending session save");
    expect(() => session.dispose()).toThrow("Pending session save");
    await rm(store);
    await rename(store + "-old", store);
    await session.flush();
    expect(requests).toBe(1);
    expect(session.state.hasPendingSave).toBe(false);
    expect((await SessionManager.open(manager.sessionFile!)).unread).toBe(true);
    expect((await SessionManager.open(manager.sessionFile!)).messages).toHaveLength(2);
    expect((await SessionManager.open(manager.sessionFile!)).getRuntimeContexts()).toEqual(
      manager.getRuntimeContexts(),
    );
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
    expect(await existsSync(join(dir, "never.txt"))).toBe(false);
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
  await writeFile(store, "blocks directory");

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

test("effort persists with the session, reaches every model call and rejects unsupported or busy changes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-effort-"));
  const thinking = {
    ...model,
    reasoning: true,
    thinkingLevelMap: { off: null, minimal: null, xhigh: "xhigh" },
  };
  const requested: (string | undefined)[] = [];
  const manager = await SessionManager.create(dir, join(dir, "sessions"));
  let release!: () => void;
  let pause = false;
  const models: ModelRuntime = {
    getModel: (_provider, id) => (id === model.id ? thinking : undefined),
    getModels: () => [thinking],
    checkModel: async () => {
      if (pause)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
    },
    streamSimple: (_model, _context, options) => {
      requested.push(options?.reasoning);
      return stream();
    },
  };
  try {
    const options = {
      cwd: dir,
      model: thinking,
      modelRuntime: models,
      sessionManager: manager,
      noContextFiles: true,
      settingsManager: SettingsManager.inMemory(),
      tools: [],
    };
    const { session } = await createAgentSession(options);
    expect(session.effort).toBe("default");
    await expect(session.setModel(thinking, { effort: "off" })).rejects.toThrow(
      "Unsupported model effort",
    );
    await session.setModel(thinking, { effort: "high" });
    await session.prompt("test");
    expect(requested).toEqual(["high"]);
    session.dispose();
    const restoredManager = await SessionManager.open(manager.sessionFile!);
    expect(restoredManager.getHeader().model?.effort).toBe("high");
    const { session: restored } = await createAgentSession({
      ...options,
      model: undefined,
      sessionManager: restoredManager,
    });
    expect(restored.effort).toBe("high");
    pause = true;
    const changing = restored.setModel(thinking, { effort: "low" });
    await expect(restored.prompt("blocked")).rejects.toThrow("already running");
    release();
    await changing;
    pause = false;
    await restored.prompt("next");
    expect(requested).toEqual(["high", "low"]);
    const messages = restored.state.messages;
    await restored.setModel(model);
    expect(restored.effort).toBe("default");
    expect(restored.state.messages).toEqual(messages);
    await expect(restored.setModel(model, { effort: "high" })).rejects.toThrow(
      "Unsupported model effort",
    );
    restored.dispose();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("prompt wall time ends before saving, survives restore and is absent from model messages", async () => {
  const dir = await mkdtemp(join(import.meta.dirname, ".prompt-duration-test-"));
  const manager = await SessionManager.create(dir, dir);
  let now = 1000;
  const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
  const commit = vi.spyOn(manager, "commit").mockImplementation(async (...args) => {
    now = 60000;
    await SessionManager.prototype.commit.apply(manager, args);
  });
  const { session } = await setup(
    runtime(() => {
      now = 30000;
      return stream();
    }),
    dir,
    manager,
  );
  const events: unknown[] = [];
  session.subscribe((event) => {
    if (event.type === "prompt_timing") events.push(event.timing);
  });
  try {
    await session.prompt("Request");
    expect(events).toEqual([
      { userMessageIndex: 0, startedAt: 1000 },
      { userMessageIndex: 0, startedAt: 1000, finishedAt: 30000 },
    ]);
    const restored = await SessionManager.open(manager.sessionFile!);
    expect(restored.getPromptTimings()).toEqual([events[1]]);
    expect(session.state.promptTimings).toEqual(restored.getPromptTimings());
    expect(JSON.stringify(restored.messages)).not.toContain("finishedAt");
  } finally {
    session.dispose();
    clock.mockRestore();
    commit.mockRestore();
    await rm(dir, { recursive: true, force: true });
  }
});
