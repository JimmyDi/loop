import { randomUUID } from "node:crypto";
import { createTypedTraceRecord, createTypedTraceBegin } from "@loop/telemetry";
import type {
  TraceRecorder,
  TraceStatus,
  TraceInput,
  SchemaTraceInput,
  SchemaTraceObservation,
} from "@loop/telemetry";

import type { SessionEvent } from "../types/session";
import type { NestedToolEvent } from "../approvals/tool-approvals";
import { SESSION_TRACE_SCHEMA } from "./trace-schema";
import type { RunInput, SessionTraceData } from "./trace-schema";
import { adaptSessionTraceEvent } from "./session-trace-event";
import type { QueuedMessage } from "../message-queue";

/** Business event adaptation stays here; the telemetry package has no session dependencies. */
export class SessionTrace {
  runId?: string;
  private lastRunId?: string;
  private operations = new Map<string, string>();

  constructor(private readonly recorder?: TraceRecorder) {}

  get status(): TraceStatus | undefined {
    return this.recorder?.status;
  }
  get enabled(): boolean {
    return this.recorder?.enabled ?? false;
  }
  get mode() {
    return this.recorder?.mode;
  }
  get modelParentId() {
    return this.operations.get("compaction") ?? this.runId;
  }

  readonly record = createTypedTraceRecord(SESSION_TRACE_SCHEMA, (input, runId) =>
    this.write(input, runId),
  );

  observation(
    event: SchemaTraceObservation<typeof SESSION_TRACE_SCHEMA>,
    operationId?: string,
    parentOperationId?: string,
  ): void {
    this.write({ type: event.type, data: event, operationId, parentOperationId });
  }

  private write(input: TraceInput, runId: string | null | undefined = this.runId): void {
    if (!this.recorder?.enabled) return;
    try {
      this.recorder.record({
        ...input,
        runId: runId ?? undefined,
      });
    } catch {
      this.recorder.record({ type: "trace.capture.failed", data: { outcome: "error" } });
    }
  }

  start(data: RunInput, resume: boolean): void {
    if (!this.enabled) return;
    this.runId = randomUUID();
    this.record(
      "run.started",
      {
        input: this.mode === "metadata" ? undefined : data,
        continuedFromRunId: resume ? this.lastRunId : undefined,
      },
      this.runId,
    );
  }

  readonly begin = createTypedTraceBegin(
    SESSION_TRACE_SCHEMA,
    (type, data, parentOperationId = this.runId) => {
      if (!this.enabled) return "";
      const id = randomUUID();
      this.write({ type: type + ".started", data, operationId: id, parentOperationId });
      if (type === "compaction") this.operations.set("compaction", id);
      return id;
    },
  );

  event(event: SessionEvent, state: QueuedMessage[] = []): void {
    if (!this.enabled) return;
    if (event.type === "message_update") return;
    if (event.type === "message_start" && event.message.role === "assistant") return;
    if (event.type === "tool_execution_start") {
      this.operations.set(
        "tool:" + event.toolCallId,
        this.begin(
          "tool",
          this.mode === "metadata"
            ? { toolName: event.toolName, toolCallId: event.toolCallId }
            : event,
        ),
      );
      return;
    }
    if (event.type === "tool_execution_end") {
      const key = "tool:" + event.toolCallId;
      this.record(
        "tool.completed",
        this.mode === "metadata"
          ? { toolName: event.toolName, toolCallId: event.toolCallId, isError: event.isError }
          : event,
        this.operations.get(key),
        this.runId,
      );
      this.operations.delete(key);
      return;
    }
    if (event.type === "approval_requested") {
      const parent = this.operations.get("tool:" + event.request.toolCallId);
      const data =
        this.mode === "metadata"
          ? {
              requestId: event.request.requestId,
              toolCallId: event.request.toolCallId,
              toolName: event.request.toolName,
              policy: event.request.policy,
            }
          : event;
      this.operations.set(
        "approval:" + event.request.requestId,
        this.begin("approval", data, parent),
      );
      return;
    }
    if (event.type === "approval_resolved") {
      const key = "approval:" + event.result.request.requestId;
      const data =
        this.mode === "metadata"
          ? {
              requestId: event.result.request.requestId,
              outcome: event.result.outcome,
              source: event.result.source,
            }
          : event;
      this.record(
        "approval.completed",
        data,
        this.operations.get(key),
        this.operations.get("tool:" + event.result.request.toolCallId),
      );
      this.operations.delete(key);
      return;
    }
    if (event.type === "compaction_start") {
      this.operations.set(
        "compaction",
        this.begin("compaction", { trigger: "automatic", ...event }),
      );
      return;
    }
    if (event.type === "compaction_end") {
      this.endCompaction(event, this.operations.get("compaction"));
      return;
    }
    const input: SchemaTraceInput<typeof SESSION_TRACE_SCHEMA> | undefined = adaptSessionTraceEvent(
      event,
      this.mode,
      state,
    );
    if (input) this.write(input, event.type === "session_title" ? null : this.runId);
  }

  nested(event: NestedToolEvent): void {
    if (!this.enabled) return;
    const key = "tool:" + event.toolCallId;
    const parent = this.operations.get("tool:" + event.parentToolCallId);
    if (event.type === "nested_tool.started")
      this.operations.set(key, this.begin("tool.nested", event, parent));
    else {
      this.record("tool.nested.completed", event, this.operations.get(key), parent);
      this.operations.delete(key);
    }
  }

  settle(outcome: SessionTraceData<"run.completed">): void {
    if (!this.runId) return;
    this.record("run.completed", outcome, this.runId);
    this.lastRunId = this.runId;
    this.runId = undefined;
    this.operations.clear();
    void this.recorder?.flush();
  }

  endCompaction(
    data: SessionTraceData<"compaction.completed">,
    operationId: string | undefined,
  ): void {
    this.record("compaction.completed", data, operationId, this.runId);
    this.operations.delete("compaction");
  }

  flush(): Promise<void> {
    return this.recorder?.flush() ?? Promise.resolve();
  }

  close(): Promise<void> {
    return this.recorder?.close() ?? Promise.resolve();
  }
}
