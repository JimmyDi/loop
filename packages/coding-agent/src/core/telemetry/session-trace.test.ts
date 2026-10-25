import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test } from "vitest";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { AssistantMessage, Context, Model } from "@earendil-works/pi-ai";
import { TraceRecorder } from "@loop/telemetry";
import type { TraceEvent } from "@loop/telemetry";

import { createAgentSession } from "../sdk";
import { SessionManager } from "../session-manager";
import { SettingsManager } from "../settings-manager";
import type { ModelRuntime } from "../model-runtime";
import { getSessionDir } from "../../config";
import { SessionTrace } from "./session-trace";
import { traceEventNames } from "./trace-event-names";
import type { SessionEvent } from "../types/session";
import type { NestedToolEvent } from "../approvals/tool-approvals";

const storedEvents = async (agentDir: string, sessionId: string): Promise<TraceEvent[]> => {
  const directory = join(
    agentDir,
    "traces",
    basename(getSessionDir(agentDir, agentDir)),
    sessionId,
  );
  const segments = (await readdir(directory))
    .filter((name) => /^events-\d+\.jsonl$/.test(name))
    .sort();
  const events: TraceEvent[] = [];
  for (const segment of segments) {
    const text = await readFile(join(directory, segment), "utf8");
    events.push(
      ...text
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as TraceEvent),
    );
  }
  return events;
};

const model: Model<"openai-completions"> = {
  api: "openai-completions",
  id: "synthetic",
  name: "Synthetic",
  provider: "synthetic",
  baseUrl: "https://provider.example.test",
  contextWindow: 100000,
  maxTokens: 1000,
  input: ["text"],
  reasoning: false,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
};

const stream = () => {
  const result = createAssistantMessageEventStream();
  const message: AssistantMessage = {
    role: "assistant",
    content: [{ type: "text", text: "synthetic answer" }],
    api: model.api,
    provider: model.provider,
    model: model.id,
    stopReason: "stop",
    timestamp: 0,
    usage: {
      input: 1,
      output: 1,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 2,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
  };
  result.push({ type: "start", partial: message });
  result.push({ type: "done", reason: "stop", message });
  return result;
};

test("core records idle changes, inputs, checkpoints and title calls without changing history or events", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-core-trace-"));
  try {
    const results: Array<{ events: string[]; requests: Context[]; roles: string[] }> = [];
    for (const telemetry of [false, { mode: "content" as const }] as const) {
      const requests: Context[] = [];
      const runtime: ModelRuntime = {
        getModel: () => model,
        getModels: () => [model],
        checkModel: async () => {},
        streamSimple: (_model, context) => {
          requests.push(structuredClone(context));
          return stream();
        },
      };
      const manager = await SessionManager.create(directory, join(directory, crypto.randomUUID()));
      const { session } = await createAgentSession({
        cwd: directory,
        agentDir: directory,
        modelRuntime: runtime,
        model,
        telemetry,
        sessionManager: manager,
        settingsManager: SettingsManager.inMemory(),
        noContextFiles: true,
        tools: [],
        title: { mode: "first-prompt" },
      });
      const events: string[] = [];
      session.subscribe((event) => {
        events.push(event.type);
      });
      try {
        await session.setModel(model);
        await session.setPermissionPreset("workspace-write");
        await session.prompt("synthetic input");
        await session.waitForTitle();
        results.push({
          events,
          requests,
          roles: session.state.messages.map((message) => message.role),
        });
        if (telemetry) {
          await session.flushTrace();
          const page = { events: await storedEvents(directory, session.sessionId) };
          expect(
            page.events.every((event) => traceEventNames.some((name) => name === event.type)),
          ).toBe(true);
          expect(page.events.map((event) => event.type)).toContain("model.input.projected");
          expect(page.events.map((event) => event.type)).toContain("session.title.updated");
          expect(page.events.map((event) => event.type)).toContain("session.save.completed");
          expect(
            page.events.find((event) => event.type === "model.change.completed")?.runId,
          ).toBeUndefined();
          const starts = page.events.filter((event) => event.type === "model.request.started");
          expect(starts.map((event) => (event.data as { purpose: string }).purpose).sort()).toEqual(
            ["main", "title"],
          );
          const run = page.events.find((event) => event.type === "run.started")!;
          expect(page.events.find((event) => event.type === "run.completed")?.runId).toBe(
            run.runId,
          );
          const text = JSON.parse(
            (await readFile(manager.getSessionFile()!, "utf8")).split("\n")[0],
          );
          expect(text.version).toBe(3);
          expect(text.header.version).toBe(2);
          expect(text).not.toHaveProperty("trace");
        }
      } finally {
        await session.abort();
        session.dispose();
        await session.flushTrace();
        if (telemetry) {
          const stored = await storedEvents(directory, session.sessionId);
          expect(stored.at(-1)?.type).toBe("session.detached");
          const traceDir = join(
            directory,
            "traces",
            basename(getSessionDir(directory, directory)),
            session.sessionId,
          );
          const manifest = JSON.parse(await readFile(join(traceDir, "manifest.json"), "utf8"));
          expect(manifest).toMatchObject({ complete: true, lastWrittenSeq: stored.at(-1)?.seq });
          expect(manifest.closedAt).toEqual(expect.any(String));
        }
      }
    }
    expect(results[1].events).toEqual(results[0].events);
    expect(results[1].roles).toEqual(results[0].roles);
    expect(
      results[1].requests.map((request) => request.messages.map((message) => message.content)),
    ).toEqual(
      results[0].requests.map((request) => request.messages.map((message) => message.content)),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("trace storage failure leaves a successful prompt successful", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-core-trace-failure-"));
  try {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(join(directory, "traces"), "synthetic obstruction");
    const runtime: ModelRuntime = {
      getModel: () => model,
      getModels: () => [model],
      checkModel: async () => {},
      streamSimple: () => stream(),
    };
    const { session } = await createAgentSession({
      cwd: directory,
      agentDir: directory,
      modelRuntime: runtime,
      model,
      settingsManager: SettingsManager.inMemory(),
      noContextFiles: true,
      tools: [],
    });
    try {
      expect(session.traceStatus?.complete).toBe(false);
      await expect(session.prompt("synthetic input")).resolves.toBeUndefined();
      expect(session.state.outcome).toBe("success");
    } finally {
      session.dispose();
      await session.flushTrace();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("queued inputs share a run, manual compaction has its own request scope, and metadata excludes content", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-core-trace-queue-"));
  try {
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    let calls = 0;
    const runtime: ModelRuntime = {
      getModel: () => model,
      getModels: () => [model],
      checkModel: async () => {},
      streamSimple: async () => {
        calls++;
        if (calls === 1) {
          entered.resolve();
          await release.promise;
        }
        return stream();
      },
    };
    const { session } = await createAgentSession({
      cwd: directory,
      agentDir: directory,
      modelRuntime: runtime,
      model,
      telemetry: { mode: "metadata" },
      settingsManager: SettingsManager.inMemory(),
      noContextFiles: true,
      tools: [],
    });
    try {
      const running = session.prompt("synthetic secret prompt ".repeat(5000));
      await entered.promise;
      await session.flushTrace();
      const pending = await storedEvents(directory, session.sessionId);
      expect(pending.some((event) => event.type === "model.request.started")).toBe(true);
      expect(pending.some((event) => event.type === "model.request.completed")).toBe(false);
      session.enqueue("synthetic queued content");
      release.resolve();
      await running;
      await session.compact();
      await session.flushTrace();
      const page = { events: await storedEvents(directory, session.sessionId) };
      expect(page.events.filter((event) => event.type === "run.started")).toHaveLength(1);
      const inputs = page.events.filter((event) => event.type === "prompt.timing.updated");
      expect(new Set(inputs.map((event) => event.runId)).size).toBe(1);
      expect(
        new Set(inputs.map((event) => (event.data as { timing: { id: string } }).timing.id)).size,
      ).toBe(2);
      const compact = page.events.find(
        (event) =>
          event.type === "compaction.started" &&
          (event.data as { trigger?: string }).trigger === "manual",
      )!;
      const summary = page.events.find(
        (event) =>
          event.type === "model.request.started" &&
          (event.data as { purpose?: string }).purpose === "compaction",
      )!;
      expect(compact.runId).toBeUndefined();
      expect(summary.parentOperationId).toBe(compact.operationId);
      expect(JSON.stringify(page)).not.toContain("synthetic secret prompt");
      expect(JSON.stringify(page)).not.toContain("synthetic queued content");
    } finally {
      release.resolve();
      await session.abort();
      session.dispose();
      await session.flushTrace();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test.each(["content", "metadata"] as const)(
  "log adaptation preserves business events, operation parents and capture mode (%s)",
  async (mode) => {
    const directory = await mkdtemp(join(tmpdir(), "loop-trace-names-"));
    const recorder = await TraceRecorder.open(directory, "synthetic-session", { mode });
    try {
      const trace = new SessionTrace(recorder);
      trace.start({ content: "synthetic input", skills: [], queued: false }, false);
      const request = {
        requestId: "synthetic-approval",
        sessionId: "synthetic-session",
        toolCallId: "synthetic-tool",
        toolName: "read",
        reason: "synthetic reason",
        policy: "ask" as const,
        createdAt: 0,
        expiresAt: null,
      };
      const events: SessionEvent[] = [
        {
          type: "message_start",
          message: { role: "user", content: "synthetic input", timestamp: 0 },
        },
        { type: "queue_changed" },
        { type: "skills_loaded", userTurn: 0, skills: [] },
        { type: "prompt_timing", timing: { startedAt: 0, userMessageIndex: 0 } },
        { type: "permission_changed", permissionPreset: "read-only" },
        {
          type: "tool_execution_start",
          toolCallId: request.toolCallId,
          toolName: "read",
          args: {},
        },
        { type: "approval_requested", request },
        { type: "approval_resolved", result: { request, outcome: "allowed-once", resolvedAt: 1 } },
        { type: "compaction_start", startedAt: 0, historyMessageCount: 1 },
        { type: "compaction_end" },
        {
          type: "session_title",
          title: { text: "Synthetic title", source: "user", messageIndices: [] },
        },
        { type: "agent_settled" },
      ];
      const originals = structuredClone(events);
      for (const event of events) trace.event(event, []);
      const nested: NestedToolEvent = {
        type: "nested_tool.started",
        toolCallId: "synthetic-tool/1",
        parentToolCallId: request.toolCallId,
        toolName: "read",
        args: { path: "synthetic.txt" },
      };
      trace.nested(nested);
      trace.nested({ ...nested, type: "nested_tool.completed", outcome: "success" });
      trace.settle({ outcome: "success" });
      await trace.flush();
      const rows = (await readFile(join(directory, "events-000001.jsonl"), "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as TraceEvent);
      expect(rows.map((row) => row.type)).toEqual([
        "run.started",
        "message.started",
        "queue.changed",
        "skill.loaded",
        "prompt.timing.updated",
        "permission.changed",
        "tool.started",
        "approval.started",
        "approval.completed",
        "compaction.started",
        "compaction.completed",
        "session.title.updated",
        "agent.settled",
        "tool.nested.started",
        "tool.nested.completed",
        "run.completed",
      ]);
      expect(events).toEqual(originals);
      expect(nested.type).toBe("nested_tool.started");
      const tool = rows.find((row) => row.type === "tool.started")!;
      const approval = rows.find((row) => row.type === "approval.started")!;
      expect(approval.parentOperationId).toBe(tool.operationId);
      expect(rows.find((row) => row.type === "approval.completed")?.operationId).toBe(
        approval.operationId,
      );
      const child = rows.find((row) => row.type === "tool.nested.started")!;
      expect(child.parentOperationId).toBe(tool.operationId);
      expect(rows.find((row) => row.type === "tool.nested.completed")?.operationId).toBe(
        child.operationId,
      );
      expect(rows.find((row) => row.type === "session.title.updated")?.runId).toBeUndefined();
      expect(JSON.stringify(rows).includes("synthetic input")).toBe(mode === "content");
      expect(rows.map((row) => row.seq)).toEqual(rows.map((_, index) => index));
    } finally {
      await recorder.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);

test("typed observations forward save and permission records once with their relationships", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-trace-observation-"));
  const recorder = await TraceRecorder.open(directory, "synthetic-session");
  try {
    const trace = new SessionTrace(recorder);
    trace.start({ skills: [], queued: false }, false);
    const runId = trace.runId;
    const save = {
      type: "session.save.started" as const,
      operationId: "synthetic-save",
      messageCount: 0,
      persisted: false,
    };
    trace.observation(save, save.operationId, runId);
    trace.observation({
      type: "permission.policy.resolved",
      preset: "read-only",
      writableRootCount: 0,
    });
    await trace.flush();
    const rows = (await readFile(join(directory, "events-000001.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as TraceEvent);
    expect(rows.map((row) => row.type)).toEqual([
      "run.started",
      "session.save.started",
      "permission.policy.resolved",
    ]);
    expect(rows[1]).toMatchObject({
      data: save,
      operationId: save.operationId,
      parentOperationId: runId,
      runId,
    });
    expect(rows[2]).toMatchObject({ runId, data: { preset: "read-only", writableRootCount: 0 } });
  } finally {
    await recorder.close();
    await rm(directory, { recursive: true, force: true });
  }
});
