import type { SchemaTraceInput, TraceMode } from "@loop/telemetry";

import type { SessionEvent } from "../types/session";
import type { QueuedMessage } from "../message-queue";
import type { SESSION_TRACE_SCHEMA } from "./trace-schema";
import { sessionTraceEventNames } from "./trace-event-names";

/** Narrow business events before pairing each log name with its payload. */
export const adaptSessionTraceEvent = (
  event: SessionEvent,
  mode: TraceMode | undefined,
  queue: QueuedMessage[],
): SchemaTraceInput<typeof SESSION_TRACE_SCHEMA> | undefined => {
  const metadata = mode === "metadata";
  switch (event.type) {
    case "message_start":
      return {
        type: sessionTraceEventNames[event.type],
        data: metadata ? { role: event.message.role } : event,
      };
    case "message_end":
      return {
        type: sessionTraceEventNames[event.type],
        data: metadata ? { role: event.message.role } : event,
      };
    case "queue_changed":
      return {
        type: sessionTraceEventNames[event.type],
        data: metadata ? { count: queue.length } : queue,
      };
    case "skills_loaded":
      return {
        type: sessionTraceEventNames[event.type],
        data: metadata
          ? {
              userTurn: event.userTurn,
              skills: event.skills.map(({ id, revision }) => ({ id, revision })),
            }
          : event,
      };
    case "session_title":
      return {
        type: sessionTraceEventNames[event.type],
        data: metadata ? { source: event.title.source, error: event.error } : event,
      };
    case "agent_settled":
      return { type: sessionTraceEventNames[event.type], data: event };
    case "prompt_timing":
      return { type: sessionTraceEventNames[event.type], data: event };
    case "context_budget":
      return { type: sessionTraceEventNames[event.type], data: event };
    case "permission_changed":
      return { type: sessionTraceEventNames[event.type], data: event };
    default:
      return undefined;
  }
};
