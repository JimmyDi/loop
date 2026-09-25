import type { Frame, SessionEvent, SessionSnapshot } from "./protocol";
import { updateTools } from "./tool-projection";

export const applyEvent = (
  snapshot: SessionSnapshot,
  event: SessionEvent,
  messageIndex?: number,
): SessionSnapshot => {
  const next = {
    ...snapshot,
    state: { ...snapshot.state },
    tools: updateTools(snapshot.tools, event),
  };

  if (event.type === "message_end" && messageIndex !== undefined) {
    const messages = [...next.state.messages];

    messages[messageIndex] = event.message;
    next.state.messages = messages;

    if (event.message.role === "assistant") {
      next.state.draft = undefined;
      next.draftIndex = undefined;
    }
  } else if ("message" in event && event.message.role === "assistant") {
    next.state.draft = event.message;
    next.draftIndex = messageIndex;
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
      state: { ...snapshot.state, isRunning: true, error: undefined, outcome: "idle" as const },
    };
  }

  return frame.type === "loop.event"
    ? applyEvent(snapshot, frame.event, frame.messageIndex)
    : snapshot;
};
