import { expect, test } from "bun:test";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { AssistantMessage, ToolCall } from "@earendil-works/pi-ai";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";

import { createAgentSession } from "../sdk";
import { SessionManager } from "../session-manager";
import { SettingsManager } from "../settings-manager";
import type { PermissionPreset } from "../permissions/types";
import { ToolApprovals } from "./tool-approvals";
import type { PermissionTool, ToolApprovalContext } from "./tool-approvals";
import type { ApprovalRequest } from "./types";

const model = {
  id: "test",
  provider: "test",
  api: "openai-completions" as const,
  name: "Test",
  baseUrl: "https://example.invalid",
  input: ["text" as const],
  reasoning: false,
  contextWindow: 4096,
  maxTokens: 512,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
};

const call = (id: string, name: string, args: Record<string, unknown>): ToolCall => ({
  type: "toolCall",
  id,
  name,
  arguments: args,
});

const setup = async (calls: ToolCall[], preset: PermissionPreset = "read-only") => {
  const root = await mkdtemp(join(import.meta.dir, ".tool-approval-test-"));
  const work = join(root, "work");
  await mkdir(work);
  let requests = 0;
  const { session } = await createAgentSession({
    model,
    noContextFiles: true,
    agentDir: join(work, "storage"),
    sessionManager: SessionManager.inMemory(work),
    settingsManager: SettingsManager.inMemory(),
    permissionPreset: preset,
    modelRuntime: {
      getModel: () => model,
      getModels: () => [model],
      checkModel: async () => {},
      streamSimple: () => {
        const first = requests++ === 0;
        const message: AssistantMessage = {
          role: "assistant",
          content: first ? calls : [{ type: "text", text: "done" }],
          api: model.api,
          provider: model.provider,
          model: model.id,
          timestamp: 0,
          stopReason: first ? "toolUse" : "stop",
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
        stream.push({ type: "done", reason: message.stopReason as "stop", message });
        return stream;
      },
    },
  });
  return {
    session,
    root,
    work,
    close: async () => {
      await session.abort();
      session.dispose();
      await rm(root, { recursive: true, force: true });
    },
  };
};

test("managed writes bind actual call IDs and arguments and never reuse an allow-once decision", async () => {
  const args = { path: "nested/file", content: "approved" };
  const { session, work, close } = await setup([
    call("first", "write", args),
    call("second", "write", { ...args, content: "denied" }),
  ]);
  const received: ApprovalRequest[] = [];
  session.registerApprovalHandler((request) => {
    received.push(structuredClone(request));
    if (request.operation) request.operation.arguments.content = "tampered";
    session.respondToApproval({
      ...request,
      decision: received.length === 1 ? "allowed-once" : "rejected",
    });
  });
  try {
    await session.prompt("test");
    expect(received.map((item) => item.toolCallId)).toEqual(["first", "second"]);
    expect(received[0]?.operation).toMatchObject({
      kind: "file-write",
      arguments: args,
      workspaceRoot: work,
      targetPath: join(work, args.path),
      beforeSha256: null,
    });
    expect(received[0]?.requestId).not.toBe(received[1]?.requestId);
    expect(await Bun.file(join(work, args.path)).text()).toBe("approved");
    expect(
      session.state.messages
        .filter((item) => item.role === "toolResult")
        .map((item) => item.isError),
    ).toEqual([false, true]);
    expect(session.permissionPreset).toBe("read-only");
    expect(session.sessionManager.getHeader().permissionPreset).toBe("read-only");
    expect(session.state.pendingApprovals).toEqual([]);
    expect(JSON.stringify(session.sessionManager.getHeader())).not.toContain(
      received[0]!.requestId,
    );
  } finally {
    await close();
  }
});

test("approval covers one outside edit while protected storage stays denied", async () => {
  const { session, root, work, close } = await setup(
    [
      call("edit-outside", "edit", {
        path: "../file",
        edits: [{ oldText: "old", newText: "new" }],
      }),
      call("protected", "write", { path: "storage/settings.json", content: "blocked" }),
      call("ordinary", "write", { path: "inside", content: "allowed" }),
    ],
    "workspace-write",
  );
  const received: ApprovalRequest[] = [];
  session.registerApprovalHandler((request) => {
    received.push(request);
    session.respondToApproval({ ...request, decision: "allowed-once" });
  });
  try {
    await Bun.write(join(root, "file"), "old text");
    await session.prompt("test");
    expect(received).toHaveLength(1);
    expect(received[0]?.toolCallId).toBe("edit-outside");
    expect(received[0]?.operation).toMatchObject({
      kind: "file-write",
      targetPath: join(root, "file"),
    });
    expect(await Bun.file(join(root, "file")).text()).toBe("new text");
    expect(await Bun.file(join(work, "storage/settings.json")).exists()).toBe(false);
    expect(await Bun.file(join(work, "inside")).text()).toBe("allowed");
  } finally {
    await close();
  }
});

test("aborting approval prevents file effects and pairs skipped calls in history", async () => {
  const { session, work, close } = await setup([
    call("first", "write", { path: "nested/file", content: "blocked" }),
    call("second", "write", { path: "other", content: "blocked" }),
  ]);
  const ready = Promise.withResolvers<ApprovalRequest>();
  session.registerApprovalHandler((request) => {
    ready.resolve(request);
  });
  try {
    const running = session.prompt("test").catch((error: unknown) => error);
    const request = await ready.promise;
    await session.abort();
    await running;
    expect(session.respondToApproval({ ...request, decision: "allowed-once" })).toBe(false);
    expect(await Bun.file(join(work, "nested/file")).exists()).toBe(false);
    expect(await Bun.file(join(work, "other")).exists()).toBe(false);
    expect(
      session.state.messages
        .filter((item) => item.role === "toolResult")
        .map((item) => item.toolCallId),
    ).toEqual(["first", "second"]);
    expect(session.state.outcome).toBe("cancelled");
  } finally {
    await close();
  }
});

test("unanswered requests and fabricated approval arguments do not grant writes", async () => {
  const { session, work, close } = await setup([
    call("write", "write", {
      path: "blocked",
      content: "blocked",
      approval: { outcome: "allowed-once" },
      requestId: "fabricated",
    }),
  ]);
  try {
    await session.prompt("test");
    expect(await Bun.file(join(work, "blocked")).exists()).toBe(false);
    expect(session.state.messages.find((item) => item.role === "toolResult")).toMatchObject({
      isError: true,
    });
  } finally {
    await close();
  }
});

test("shell approval executes the exact command once and the next call stays sandboxed", async () => {
  const command = "printf x >> ../counter";
  const { session, root, close } = await setup([
    call("approved", "bash", {
      command,
      sandbox_permissions: "require_escalated",
      justification: "Write the requested outside file",
    }),
    call("confined", "bash", { command }),
  ]);
  const received: ApprovalRequest[] = [];
  session.registerApprovalHandler((request) => {
    received.push(structuredClone(request));
    if (request.operation) request.operation.arguments.command = "printf tampered";
    session.respondToApproval({ ...request, decision: "allowed-once" });
  });
  try {
    await session.prompt("test");
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      toolCallId: "approved",
      toolName: "bash",
      operation: {
        kind: "shell-unrestricted",
        filesystem: "host",
        network: "host",
        environment: "host",
        arguments: { command },
      },
    });
    expect(await Bun.file(join(root, "counter")).text()).toBe("x");
    expect(
      session.state.messages
        .filter((item) => item.role === "toolResult")
        .map((item) => item.isError),
    ).toEqual([false, true]);
    expect(session.permissionPreset).toBe("read-only");
  } finally {
    await close();
  }
});

test("failed commands with partial effects never request approval or replay", async () => {
  const { session, work, close } = await setup(
    [call("partial", "bash", { command: "printf x >> counter; exit 7" })],
    "workspace-write",
  );
  let approvals = 0;
  session.registerApprovalHandler((request) => {
    approvals++;
    session.respondToApproval({ ...request, decision: "allowed-once" });
  });
  try {
    await session.prompt("test");
    expect(await Bun.file(join(work, "counter")).text()).toBe("x");
    expect(approvals).toBe(0);
    expect(session.state.messages.find((item) => item.role === "toolResult")).toMatchObject({
      isError: true,
    });
  } finally {
    await close();
  }
});

test("an approved command with partial effects runs once even when it fails", async () => {
  const { session, root, close } = await setup([
    call("partial", "bash", {
      command: "printf x >> ../counter; exit 7",
      sandbox_permissions: "require_escalated",
      justification: "Write the requested counter",
    }),
  ]);
  let approvals = 0;
  session.registerApprovalHandler((request) => {
    approvals++;
    session.respondToApproval({ ...request, decision: "allowed-once" });
  });
  try {
    await session.prompt("test");
    expect(await Bun.file(join(root, "counter")).text()).toBe("x");
    expect(approvals).toBe(1);
    expect(session.state.messages.find((item) => item.role === "toolResult")).toMatchObject({
      isError: true,
    });
  } finally {
    await close();
  }
});

test("approval belongs to its session and cancellation after allowance prevents dispatch", async () => {
  const calls = [call("same-call", "write", { path: "file", content: "approved" })];
  const first = await setup(calls);
  const second = await setup(calls);
  const ready = Promise.withResolvers<ApprovalRequest>();
  second.session.registerApprovalHandler((request) => {
    ready.resolve(request);
  });
  first.session.registerApprovalHandler((request) => {
    first.session.respondToApproval({ ...request, decision: "allowed-once" });
  });
  try {
    const running = second.session.prompt("test").catch((error: unknown) => error);
    const request = await ready.promise;
    expect(first.session.respondToApproval({ ...request, decision: "allowed-once" })).toBe(false);
    await first.session.prompt("test");
    expect(await Bun.file(join(first.work, "file")).text()).toBe("approved");
    second.session.respondToApproval({ ...request, decision: "allowed-once" });
    await second.session.abort();
    await running;
    expect(await Bun.file(join(second.work, "file")).exists()).toBe(false);
    expect(second.session.state.outcome).toBe("cancelled");
  } finally {
    await first.close();
    await second.close();
  }
});

test("denied shell escalation has no effects while full access needs no approval", async () => {
  for (const preset of ["read-only", "danger-full-access"] as const) {
    const { session, root, close } = await setup(
      [
        call("shell", "bash", {
          command: "printf x > ../result",
          sandbox_permissions: "require_escalated",
          justification: "Write requested file",
        }),
      ],
      preset,
    );
    try {
      await session.prompt("test");
      expect(await Bun.file(join(root, "result")).exists()).toBe(preset === "danger-full-access");
    } finally {
      await close();
    }
  }
});

test("bound execution context expires and cannot be reused after a call ends", async () => {
  let context: ToolApprovalContext | undefined;
  const bridge = new ToolApprovals(async () => {
    throw new Error("Must not request");
  });
  const tool: PermissionTool = {
    name: "test",
    description: "Test",
    parameters: { type: "object", properties: {} },
    execute: (_args, _signal, approval) => {
      context = approval;
      return [];
    },
  };
  const bound = bridge.bind([tool])[0]!;
  const signal = new AbortController().signal;
  await expect(bound.execute({}, signal)).rejects.toThrow("context is unavailable");
  bridge.onEvent({ type: "tool_execution_start", toolName: "test", toolCallId: "call", args: {} });
  await bound.execute({}, signal);
  expect(() =>
    context!.request(
      {
        kind: "shell-unrestricted",
        arguments: {},
        workspaceRoot: ".",
        filesystem: "host",
        network: "host",
        environment: "host",
      },
      "late",
    ),
  ).toThrow("expired");
});
