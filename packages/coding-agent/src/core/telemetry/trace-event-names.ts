import type { SessionEvent } from "../types/session";
import { SESSION_TRACE_SCHEMA } from "./trace-schema";
import type { SessionTraceEventName } from "./trace-schema";

export const traceEventNames = Object.keys(SESSION_TRACE_SCHEMA.events);

/** Undefined entries are intentionally captured at another boundary or omitted. */
export const sessionTraceEventNames = {
  message_start: "message.started",
  message_update: undefined,
  message_end: "message.completed",
  tool_execution_start: "tool.started",
  tool_execution_end: "tool.completed",
  approval_requested: "approval.started",
  approval_resolved: "approval.completed",
  agent_settled: "agent.settled",
  queue_changed: "queue.changed",
  prompt_timing: "prompt.timing.updated",
  context_budget: "context.budget.updated",
  compaction_start: "compaction.started",
  compaction_end: "compaction.completed",
  skills_loaded: "skill.loaded",
  permission_changed: "permission.changed",
  session_title: "session.title.updated",
} as const satisfies Record<SessionEvent["type"], SessionTraceEventName | undefined>;
