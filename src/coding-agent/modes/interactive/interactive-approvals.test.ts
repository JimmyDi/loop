import { expect, test } from "bun:test";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";

import { AgentSession } from "../../core/agent-session";
import { SessionManager } from "../../core/session-manager";
import { InteractiveApprovals } from "./interactive-approvals";

const createSession = () => {
  const model = {
    id: "test",
    name: "Test",
    provider: "test",
    api: "openai-completions" as const,
    baseUrl: "https://example.invalid",
    reasoning: false,
    input: ["text" as const],
    contextWindow: 4096,
    maxTokens: 128,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  };
  return new AgentSession({
    model,
    systemPrompt: "Test",
    tools: [],
    sessionManager: SessionManager.inMemory(),
    modelRuntime: {
      getModel: () => model,
      getModels: () => [model],
      checkModel: async () => {},
      streamSimple: () => createAssistantMessageEventStream(),
    },
  });
};

const input = {
  toolName: "bash",
  toolCallId: "example",
  reason: "Review command",
  operation: {
    kind: "shell-unrestricted" as const,
    arguments: { command: "printf example" },
    workspaceRoot: "/workspace",
    filesystem: "host" as const,
    network: "host" as const,
    environment: "host" as const,
  },
};

test("terminal approval displays exact scope, requires a live ID, and rebinds per session", async () => {
  const first = createSession();
  const second = createSession();
  const lines: string[] = [];
  const approvals = new InteractiveApprovals((line) => lines.push(line), true);
  approvals.bind(first);
  try {
    const pending = first.requestApproval(input);
    const id = first.state.pendingApprovals![0]!.requestId;
    expect(lines.join("")).toContain("printf example");
    expect(lines.join("")).toContain("host filesystem, network and environment");
    expect(lines.join("")).toContain("/approve " + id);
    expect(lines.join("")).not.toContain("expiresAt");
    expect(approvals.handle("yes")).toBe(false);
    expect(() => approvals.handle("/approve")).toThrow("REQUEST_ID");
    expect(() => approvals.handle("/approve wrong")).toThrow("no longer pending");
    expect(first.state.pendingApprovals).toHaveLength(1);
    expect(approvals.handle("/approve " + id)).toBe(true);
    expect((await pending).outcome).toBe("allowed-once");
    expect(() => approvals.handle("/approve " + id)).toThrow();
    const abandoned = first.requestApproval(input);
    approvals.bind(second);
    expect((await abandoned).outcome).toBe("unavailable");
    expect((await first.requestApproval(input)).outcome).toBe("unavailable");
    const rejected = second.requestApproval(input);
    expect(() => approvals.handle("/approve " + id)).toThrow();
    approvals.handle("/reject " + second.state.pendingApprovals![0]!.requestId);
    expect((await rejected).outcome).toBe("rejected");
    const expired = second.requestApproval(input, { timeoutMs: 10 });
    expect((await expired).outcome).toBe("timed-out");
    expect(lines.at(-1)).toContain("timed-out");
    const cancelled = second.requestApproval(input);
    await second.abort();
    expect((await cancelled).outcome).toBe("cancelled");
  } finally {
    approvals.dispose();
    first.dispose();
    second.dispose();
  }
});

test("noninteractive input cannot register an approval handler or answer a request", async () => {
  const session = createSession();
  const approvals = new InteractiveApprovals(() => {
    throw new Error("Unexpected output");
  }, false);
  approvals.bind(session);
  try {
    expect((await session.requestApproval(input)).outcome).toBe("unavailable");
    expect(() => approvals.handle("/approve example")).toThrow("no longer pending");
  } finally {
    approvals.dispose();
    session.dispose();
  }
});
