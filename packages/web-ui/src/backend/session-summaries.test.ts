import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { existsSync } from "node:fs";
import { expect, test } from "vitest";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";

import { AgentSession, getSessionDir, SessionManager } from "@loop/coding-agent";
import { createLoopBridge } from "./loop";
import { ProjectStore } from "./projects/project-store";
import { ProviderSettings } from "./providers/provider-settings";
import { SessionRegistry } from "./session-registry";
import { createRouter } from "./router";
import type { ListFrame, SessionSummary } from "../shared/protocol";
import { SessionController } from "./session-controller";
import { sessionSummaries } from "./session-summaries";
import { ListEvents } from "./list-events";

test("approval lifecycle refreshes background summaries and clears waiting on resolution", async () => {
  const model = {
    id: "example",
    provider: "example",
    name: "Example",
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
      streamSimple: () => {
        throw new Error("This test must not call the model");
      },
    },
  });
  const controller = new SessionController(session, "project");
  const records: SessionSummary[] = [
    {
      id: session.sessionId,
      workspaceId: "project",
      createdAt: controller.createdAt,
      updatedAt: controller.createdAt,
      messageCount: 2,
      userMessageCount: 1,
    },
  ];
  const summary = () => sessionSummaries(records, [controller], "project")[0]!;
  const events = new ListEvents();
  const changes: boolean[] = [];
  events.watch(controller);
  events.connect((frame) => {
    if (frame.type === "sessions.changed") changes.push(summary().isWaitingForApproval!);
  });
  let disconnect = controller.approvals.connect(() => {});
  try {
    expect(summary().isWaitingForApproval).toBe(false);
    for (const outcome of ["allowed-once", "rejected", "cancelled"] as const) {
      const pending = session.requestApproval({
        toolCallId: "call",
        toolName: "write",
        reason: "Create the requested file",
      });
      const request = session.state.pendingApprovals![0]!;
      expect(summary().isWaitingForApproval).toBe(true);
      expect(summary().isGenerating).toBe(false);
      expect(changes.at(-1)).toBe(true);
      disconnect();
      expect(summary().isWaitingForApproval).toBe(true);
      disconnect = controller.approvals.connect(() => {});
      if (outcome === "cancelled") await controller.abort();
      else controller.approvals.respond(request.requestId, outcome);
      expect((await pending).outcome).toBe(outcome);
      expect(summary().isWaitingForApproval).toBe(false);
      expect(changes.at(-1)).toBe(false);
    }
    expect(changes).toEqual([true, false, true, false, true, false]);
    // Disk records cannot restore transient waiting state after a restart.
    expect(
      sessionSummaries([{ ...records[0]!, isWaitingForApproval: true }], [], "project")[0],
    ).toMatchObject({ isGenerating: false, isWaitingForApproval: false });
    expect(sessionSummaries([], [controller], "other-project")).toEqual([]);
  } finally {
    disconnect();
    events.close();
    await controller.close();
  }
});

test("new Web sessions remain drafts until the first user message, appear during streaming and survive restart", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".draft-session-test-"));
  const model = {
    id: "example",
    provider: "example",
    name: "Example",
    api: "openai-completions" as const,
    baseUrl: "http://localhost",
    reasoning: false,
    input: ["text" as const, "image" as const],
    // The real bridge also loads ancestor project instructions and enabled tool schemas.
    contextWindow: 128000,
    maxTokens: 128,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  };
  let reject = false;
  let calls = 0;
  const stream = createAssistantMessageEventStream();
  class Settings extends ProviderSettings {
    async runtime() {
      return {
        getModel: () => model,
        getModels: () => [model],
        checkModel: async () => {
          if (reject) throw new Error("Model unavailable");
        },
        streamSimple: () => {
          calls++;
          return stream;
        },
      };
    }
    defaultModel() {
      return model;
    }
    defaultEffort() {
      return undefined;
    }
  }
  const projects = new ProjectStore(join(root, "projects.json"));
  const bridge = createLoopBridge(root, new Settings(join(root, "providers.json")));
  const registry = new SessionRegistry(projects, bridge);
  const route = createRouter(registry);
  const call = (path: string, body?: unknown) =>
    route(
      new Request("http://localhost/api" + path, {
        method: body ? "POST" : "GET",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
  try {
    const project = await projects.add(root);
    const changes: ListFrame[] = [];
    const otherPage: ListFrame[] = [];
    registry.events.connect((frame) => changes.push(frame));
    registry.events.connect((frame) => otherPage.push(frame));
    const endpoint = "/sessions?workspaceId=" + project.id;
    const first = await (await call("/sessions", { workspaceId: project.id })).json();
    const second = await (await call("/sessions", { workspaceId: project.id })).json();
    expect(first.sessionId).not.toBe(second.sessionId);
    expect(changes.map((frame) => frame.type)).toEqual(["lists.reset"]);
    expect(await (await call(endpoint)).json()).toEqual([]);
    expect(await SessionManager.list(root, getSessionDir(root, root))).toEqual([]);
    const controller = await registry.get(first.sessionId);
    await controller.command("title", () => controller.session.renameTitle("Draft name"));
    expect(await (await call(endpoint)).json()).toEqual([]);
    const stored = await SessionManager.create(root, getSessionDir(root, root));
    expect(await (await call(endpoint)).json()).toEqual([]);
    expect(
      (await call("/sessions/" + first.sessionId + "/prompt", { requestId: "empty", text: "" }))
        .status,
    ).toBe(400);
    reject = true;
    controller.prompt("rejected", "Example");
    for (let i = 0; i < 100 && controller.busy; i++) await sleep(2);
    expect(controller.busy).toBe(false);
    expect(calls).toBe(0);
    expect(await (await call(endpoint)).json()).toEqual([]);
    reject = false;
    const image = { type: "image" as const, data: "AAAA", mimeType: "image/png" };
    const body = { requestId: "first-user", text: "", images: [image] };
    const beforePrompt = changes.length;
    const accepted = await call("/sessions/" + first.sessionId + "/prompt", body);
    expect(accepted.status).toBe(202);
    for (let i = 0; i < 100 && !calls; i++) await sleep(2);
    expect(calls).toBe(1);
    // No per-chat SSE is connected; first-user visibility reaches both pages.
    expect(changes.slice(beforePrompt).length).toBeGreaterThanOrEqual(2);
    expect(changes.at(-1)).toMatchObject({ type: "sessions.changed", workspaceId: project.id });
    expect(otherPage).toEqual(changes);
    const visible = await (await call(endpoint)).json();
    expect(visible).toHaveLength(1);
    expect(visible[0]).toMatchObject({
      id: first.sessionId,
      userMessageCount: 1,
      isGenerating: true,
    });
    expect(await (await call("/sessions/" + first.sessionId + "/prompt", body)).json()).toEqual(
      await accepted.json(),
    );
    expect(await existsSync(join(getSessionDir(root, root), first.sessionId + ".jsonl"))).toBe(
      false,
    );
    const beforeAbort = changes.length;
    await controller.abort();
    expect(changes.length).toBeGreaterThan(beforeAbort);
    expect((await (await call(endpoint)).json())[0].isGenerating).toBe(false);
    expect((await (await call(endpoint)).json())[0].unread).toBe(false);
    expect(otherPage).toEqual(changes);
    expect(await existsSync(join(getSessionDir(root, root), first.sessionId + ".jsonl"))).toBe(
      true,
    );
    await registry.close();
    const restarted = new SessionRegistry(projects, bridge);
    expect(
      (await restarted.list(project.id))
        .filter((item) => item.userMessageCount > 0)
        .map((item) => item.id),
    ).toEqual([first.sessionId]);
    expect((await restarted.get(first.sessionId)).session.state.messages[0]).toMatchObject({
      role: "user",
      content: [image],
    });
    expect(await existsSync(stored.sessionFile!)).toBe(true);
    await restarted.close();
  } finally {
    await registry.close();
    await rm(root, { recursive: true, force: true });
  }
});
