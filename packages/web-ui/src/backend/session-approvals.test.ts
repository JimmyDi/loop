import { expect, vi, test } from "vitest";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";

import { AgentSession, SessionManager } from "@loop/coding-agent";
import type { Frame } from "../shared/protocol";
import { SessionController } from "./session-controller";
import { SessionApprovals } from "./session-approvals";
import { eventResponse } from "./http/sse";

const setup = () => {
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
  const session = new AgentSession({
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
  const controller = new SessionController(session, "project");
  const approvals = new SessionApprovals(session, controller.events);
  return { session, controller, approvals };
};

const input = { toolCallId: "call", toolName: "write", reason: "Review this change" };

test("only interactive connections enable approval; tabs share one handler and first decision wins", async () => {
  const { session, controller, approvals } = setup();
  const frames: Frame[] = [];
  const viewer = controller.events.connect((frame) => frames.push(frame));
  try {
    expect((await session.requestApproval(input)).outcome).toBe("unavailable");
    const first = approvals.connect((frame) => frames.push(frame));
    const second = approvals.connect(() => {});
    const pending = session.requestApproval(input);
    const request = session.state.pendingApprovals![0]!;
    expect(controller.busy).toBe(true);
    expect(controller.snapshot.state.pendingApprovals).toEqual([request]);
    first();
    first();
    approvals.respond(request.requestId, "allowed-once");
    expect((await pending).outcome).toBe("allowed-once");
    expect(() => approvals.respond(request.requestId, "rejected")).toThrow("approval_not_pending");
    expect(controller.snapshot.lastApproval?.outcome).toBe("allowed-once");
    expect(controller.busy).toBe(false);
    second();
  } finally {
    viewer();
    approvals.dispose();
    await controller.close();
  }
});

test("pending requests survive long disconnects and reconnect while new disconnected requests fail", async () => {
  vi.useFakeTimers();
  const { session, controller, approvals } = setup();
  try {
    const disconnect = approvals.connect(() => {});
    const pending = session.requestApproval(input);
    const id = session.state.pendingApprovals![0]!.requestId;
    const cursor = { streamId: controller.events.streamId, seq: 0 };
    disconnect();
    vi.advanceTimersByTime(86_400_000);
    await Promise.resolve();
    expect(session.state.pendingApprovals?.map((request) => request.requestId)).toEqual([id]);
    expect(() => approvals.respond(id, "allowed-once")).toThrow("approval_not_pending");
    expect((await session.requestApproval(input)).outcome).toBe("unavailable");
    const frames: Frame[] = [];
    const detach = approvals.connect((frame) => frames.push(frame), cursor);
    expect(
      frames.some(
        (frame) =>
          "snapshot" in frame &&
          frame.snapshot.state.pendingApprovals?.some((request) => request.requestId === id),
      ),
    ).toBe(true);
    approvals.respond(id, "rejected");
    expect((await pending).outcome).toBe("rejected");
    const abandoned = session.requestApproval(input);
    const abandonedId = session.state.pendingApprovals![0]!.requestId;
    detach();
    vi.advanceTimersByTime(86_400_000);
    await Promise.resolve();
    const fresh = approvals.connect(() => {});
    approvals.respond(abandonedId, "allowed-once");
    expect((await abandoned).outcome).toBe("allowed-once");
    expect(session.state.pendingApprovals).toEqual([]);
    expect(() => approvals.respond(id, "allowed-once")).toThrow();
    fresh();
  } finally {
    approvals.dispose();
    await controller.close();
    vi.useRealTimers();
  }
});

test("wrong-session decisions, expired requests, abort and teardown never grant authority", async () => {
  const first = setup();
  const second = setup();
  first.approvals.connect(() => {});
  second.approvals.connect(() => {});
  try {
    const timed = first.session.requestApproval(input, { timeoutMs: 15 });
    const id = first.session.state.pendingApprovals![0]!.requestId;
    expect(() => second.approvals.respond(id, "allowed-once")).toThrow();
    await expect(first.controller.command("permission", async () => {})).rejects.toThrow(
      "session_busy",
    );
    expect((await timed).outcome).toBe("timed-out");
    expect(() => first.approvals.respond(id, "allowed-once")).toThrow();
    const cancelled = first.session.requestApproval(input);
    await first.controller.abort();
    expect((await cancelled).outcome).toBe("cancelled");
    const closed = first.session.requestApproval(input);
    first.approvals.dispose();
    expect((await closed).outcome).toBe("unavailable");
    expect(() => first.approvals.connect(() => {})).toThrow("session_closed");
  } finally {
    first.approvals.dispose();
    second.approvals.dispose();
    await first.controller.close();
    await second.controller.close();
  }
});

test("SSE cancellation removes the interactive client and reconnect starts with current pending state", async () => {
  const { session, controller, approvals } = setup();
  try {
    const response = eventResponse(approvals, new Request("http://localhost/api/events"));
    const reader = response.body!.getReader();
    await reader.read();
    const pending = session.requestApproval(input);
    const id = session.state.pendingApprovals![0]!.requestId;
    await reader.cancel();
    expect(() => approvals.respond(id, "allowed-once")).toThrow();
    const abort = new AbortController();
    const reconnected = eventResponse(
      approvals,
      new Request("http://localhost/api/events", { signal: abort.signal }),
    );
    const next = reconnected.body!.getReader();
    expect(new TextDecoder().decode((await next.read()).value)).toContain(id);
    abort.abort();
    expect((await next.read()).done).toBe(true);
    expect(session.state.pendingApprovals?.map((request) => request.requestId)).toEqual([id]);
    await controller.abort();
    expect((await pending).outcome).toBe("cancelled");
  } finally {
    approvals.dispose();
    await controller.close();
  }
});
