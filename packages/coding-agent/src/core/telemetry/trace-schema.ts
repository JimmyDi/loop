import type {
  AssistantMessage,
  AssistantMessageEvent,
  Context,
  Message,
  SimpleStreamOptions,
} from "@earendil-works/pi-ai";
import { defineTraceEvent, defineTraceSchema } from "@loop/telemetry";
import type { TraceEventData, TraceEventName } from "@loop/telemetry";

import type { PromptContent } from "@loop/agent";
import type { SessionEvent, SessionState } from "../types/session";
import type { SessionWriteEvent } from "../session-manager";
import type { PermissionObservation } from "../permissions/policy";
import type { PermissionPreset } from "../permissions/types";
import type { ApprovalOutcome } from "../approvals/types";
import type { NestedToolEvent } from "../approvals/tool-approvals";
import type { QueuedMessage } from "../message-queue";
import type { ModelEffort } from "../models/model-effort";
import type { ModelInputProjection } from "../model-input-projection";
import type { SessionTitle } from "../titles/types";
import type { CompactionCheckpoint } from "../context/compaction-checkpoint";

type Business<Type extends SessionEvent["type"]> = Extract<SessionEvent, { type: Type }>;
type Outcome = { outcome: SessionState["outcome"]; error?: string };
type ModelChange = { provider: string; id: string; effort: ModelEffort };
type SkillRevision = { id: string; revision: string };
export type RunInput = { content?: PromptContent; skills: string[]; queued: boolean };
export type ModelTraceResult =
  | AssistantMessage
  | Pick<AssistantMessage, "stopReason" | "usage" | "errorMessage">
  | { outcome: "cancelled" | "incomplete" | "interrupted" | "error"; error?: string };
type StreamDelta<Event = AssistantMessageEvent> = Event extends unknown
  ? Omit<Event, "partial">
  : never;
type CompactionResult =
  | Business<"compaction_end">
  | (Outcome & { checkpoint?: string | CompactionCheckpoint });

/** Payload contracts before mode filtering/redaction; schema metadata contains no runtime data. */
export const SESSION_TRACE_SCHEMA = defineTraceSchema({
  version: 1,
  events: {
    "session.attached": defineTraceEvent<{
      model: ModelChange;
      permissionPreset?: PermissionPreset;
      messageCount: number;
    }>("Session recording attached"),
    "session.detached": defineTraceEvent<undefined>("Session recording detached"),
    "session.save.started": defineTraceEvent<SessionWriteEvent>("History write started"),
    "session.save.completed": defineTraceEvent<SessionWriteEvent>("History write settled"),
    "session.title.updated": defineTraceEvent<
      Business<"session_title"> | { source: SessionTitle["source"]; error?: string }
    >("Title state updated"),
    "run.started": defineTraceEvent<{ input?: RunInput; continuedFromRunId?: string }>(
      "Execution started",
    ),
    "run.completed": defineTraceEvent<Outcome & { hasPendingSave?: boolean }>("Execution settled"),
    "run.cancel.requested": defineTraceEvent<undefined>("Execution cancellation requested"),
    "agent.settled": defineTraceEvent<Business<"agent_settled">>("Agent state settled"),
    "input.prepare.started": defineTraceEvent<{ skills: string[]; resume: boolean }>(
      "Input preparation started",
    ),
    "input.prepare.completed": defineTraceEvent<
      | { outcome: "success"; skills: SkillRevision[] }
      | { outcome: "error" | "cancelled"; error: string }
    >("Input preparation settled"),
    "input.consumed": defineTraceEvent<QueuedMessage | Pick<QueuedMessage, "id" | "skills">>(
      "Queued input consumed",
    ),
    "message.started": defineTraceEvent<Business<"message_start"> | { role: Message["role"] }>(
      "Message started",
    ),
    "message.completed": defineTraceEvent<Business<"message_end"> | { role: Message["role"] }>(
      "Message completed",
    ),
    "queue.changed": defineTraceEvent<QueuedMessage[] | { count: number }>("Queue state changed"),
    "prompt.timing.updated": defineTraceEvent<Business<"prompt_timing">>("Prompt timing updated"),
    "context.budget.updated":
      defineTraceEvent<Business<"context_budget">>("Context budget updated"),
    "skill.loaded": defineTraceEvent<
      Business<"skills_loaded"> | { userTurn: number; skills: SkillRevision[] }
    >("Skill revisions loaded"),
    "model.change.started": defineTraceEvent<ModelChange>("Model selection change started"),
    "model.change.completed": defineTraceEvent<
      (ModelChange & { outcome: "success" }) | { outcome: "error"; error: string }
    >("Model selection change settled"),
    "model.input.projected": defineTraceEvent<ModelInputProjection>(
      "Model input origins projected",
    ),
    "model.request.started": defineTraceEvent<{
      purpose: string;
      model: { provider: string; id: string; api: AssistantMessage["api"] };
      options: Pick<SimpleStreamOptions, "maxTokens" | "reasoning" | "temperature">;
      context?: Context;
    }>("Logical model request started"),
    "model.request.completed": defineTraceEvent<{
      purpose: string;
      durationMs: number;
      result: ModelTraceResult;
    }>("Logical model request settled"),
    "model.stream.received": defineTraceEvent<StreamDelta>("Native stream event consumed"),
    "tool.started": defineTraceEvent<
      Business<"tool_execution_start"> | { toolName: string; toolCallId: string }
    >("Tool execution started"),
    "tool.completed": defineTraceEvent<
      Business<"tool_execution_end"> | { toolName: string; toolCallId: string; isError: boolean }
    >("Tool execution settled"),
    "tool.nested.started": defineTraceEvent<NestedToolEvent>("Nested tool execution started"),
    "tool.nested.completed": defineTraceEvent<NestedToolEvent>("Nested tool execution settled"),
    "approval.started": defineTraceEvent<
      | Business<"approval_requested">
      | { requestId: string; toolCallId: string; toolName: string; policy: "ask" | "never" }
    >("Approval wait started"),
    "approval.completed": defineTraceEvent<
      | Business<"approval_resolved">
      | { requestId: string; outcome: ApprovalOutcome; source?: "session-grant" | "full-access" }
    >("Approval wait settled"),
    "permission.change.started": defineTraceEvent<{ preset: PermissionPreset }>(
      "Permission selection change started",
    ),
    "permission.change.completed": defineTraceEvent<
      { preset: PermissionPreset; outcome: "success" } | { outcome: "error"; error: string }
    >("Permission selection change settled"),
    "permission.changed": defineTraceEvent<Business<"permission_changed">>(
      "Persisted permission updated",
    ),
    "permission.policy.resolved": defineTraceEvent<
      Extract<PermissionObservation, { type: "permission.policy.resolved" }>
    >("Effective policy resolved"),
    "permission.write.checked":
      defineTraceEvent<Extract<PermissionObservation, { type: "permission.write.checked" }>>(
        "Write target checked",
      ),
    "compaction.started": defineTraceEvent<{
      trigger: "manual" | "automatic";
      historyMessageCount: number;
      startedAt?: number;
      type?: "compaction_start";
    }>("Context compaction started"),
    "compaction.completed": defineTraceEvent<CompactionResult>("Context compaction settled"),
    "trace.capture.failed": defineTraceEvent<{ outcome: "error" }>("Event capture failed"),
  },
});

export type SessionTraceEventName = TraceEventName<typeof SESSION_TRACE_SCHEMA>;
export type SessionTraceData<Name extends SessionTraceEventName> = TraceEventData<
  typeof SESSION_TRACE_SCHEMA,
  Name
>;
