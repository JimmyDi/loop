import type { Frame, SessionEvent, SessionSnapshot } from "./protocol";
import { updateTools } from "./tool-projection";

export const applyEvent = (
  snapshot: SessionSnapshot,
  event: SessionEvent,
  messageIndex?: number,
): SessionSnapshot => {
  const next: SessionSnapshot = {
    ...snapshot,
    state: { ...snapshot.state },
    tools: updateTools(snapshot.tools, event),
  };

  if (event.type === "approval_requested") {
    next.state.pendingApprovals = [
      ...(next.state.pendingApprovals ?? []).filter(
        (request) => request.requestId !== event.request.requestId,
      ),
      event.request,
    ];
  } else if (event.type === "approval_resolved") {
    const { outcome, resolvedAt, request } = event.result;
    next.lastApproval = {
      outcome,
      resolvedAt,
      request: {
        sessionId: request.sessionId,
        requestId: request.requestId,
        toolName: request.toolName,
      },
    };
    next.state.pendingApprovals = (next.state.pendingApprovals ?? []).filter(
      (request) => request.requestId !== event.result.request.requestId,
    );
  } else if (event.type === "permission_changed") {
    next.state.permissionPreset = event.permissionPreset;
  } else if (event.type === "run_timing") {
    next.state.runTimings = [
      ...(next.state.runTimings ?? []).filter(
        (timing) => timing.userMessageIndex !== event.timing.userMessageIndex,
      ),
      event.timing,
    ];
  } else if (event.type === "session_title") {
    next.state.title = event.title;
    next.state.titleError = event.error;
  } else if (event.type === "message_end" && messageIndex !== undefined) {
    const messages = [...next.state.messages];

    messages[messageIndex] = event.message;
    next.state.messages = messages;

    if (event.message.role === "assistant") {
      next.state.draft = undefined;
      next.draftIndex = undefined;
      next.draftPhase = undefined;
    }
  } else if ("message" in event && event.message.role === "assistant") {
    next.state.draft = event.message;
    next.draftIndex = messageIndex;

    if (event.type === "message_start") next.draftPhase = undefined;
    if (event.type === "message_update") {
      switch (event.assistantMessageEvent.type) {
        case "thinking_start":
        case "thinking_delta":
          next.draftPhase = "thinking";
          break;
        case "thinking_end":
          next.draftPhase = "thinking-complete";
          break;
        case "text_start":
        case "text_delta":
        case "text_end":
          next.draftPhase = "text";
          break;
        case "toolcall_start":
        case "toolcall_delta":
        case "toolcall_end":
          next.draftPhase = "tool";
          break;
      }
    }
  }

  return next;
};

export const applyFrame = (snapshot: SessionSnapshot | undefined, frame: Frame) => {
  if (frame.type === "session.snapshot" || frame.type === "session.state") return frame.snapshot;

  if (!snapshot) return undefined;

  if (frame.type === "run.accepted") {
    return {
      ...snapshot,
      operation: "prompt" as const,
      runId: frame.runId,
      requestId: frame.requestId,
      commandError: undefined,
      draftPhase: undefined,
      state: { ...snapshot.state, isRunning: true, error: undefined, outcome: "idle" as const },
    };
  }

  return frame.type === "loop.event"
    ? applyEvent(snapshot, frame.event, frame.messageIndex)
    : snapshot;
};
