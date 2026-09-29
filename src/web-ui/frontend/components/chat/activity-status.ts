import type { DraftPhase, SessionState, ToolView } from "../../../shared/protocol";
import type { TurnMessage } from "./timeline-turns";
import { readAssistantText } from "../../../shared/assistant-text";

export type ActivityStatus = "running" | "success" | "error" | "cancelled" | "idle";

export const activityStatus = (
  messages: readonly TurnMessage[],
  running: boolean,
  outcome?: SessionState["outcome"],
): ActivityStatus => {
  if (running) return "running";
  if (outcome && outcome !== "idle") return outcome;

  const last = messages.at(-1)?.message;

  if (last?.role !== "assistant") return "idle";
  if (last.stopReason === "aborted") return "cancelled";
  if (last.errorMessage || !["stop", "toolUse"].includes(last.stopReason)) return "error";
  if (last.content.some((part) => part.type === "toolCall")) return "idle";
  return "success";
};

export const executionStatus = (
  messages: readonly TurnMessage[],
  tools: Record<string, ToolView>,
  running: boolean,
  outcome?: SessionState["outcome"],
  draftPhase?: DraftPhase,
): ActivityStatus => {
  if (!running) return activityStatus(messages, false, outcome);

  const pending = messages.some(
    ({ message }) =>
      message.role === "assistant" &&
      message.content.some((part) => {
        if (part.type !== "toolCall") return false;
        const status = tools[part.id]?.status;
        return status !== "success" && status !== "error";
      }),
  );

  if (pending || draftPhase === "thinking" || draftPhase === "tool") return "running";
  const latest = messages.at(-1)?.message;
  const latestText =
    latest?.role === "assistant"
      ? [...latest.content].reverse().find((part) => part.type === "text")
      : undefined;
  if (
    draftPhase === "text" &&
    latestText?.type === "text" &&
    readAssistantText(latestText, true).phase === "commentary"
  )
    return "running";
  if (draftPhase === "thinking-complete" || draftPhase === "text") return "success";

  const last = messages.at(-1)?.message;
  const part = last?.role === "assistant" ? last.content.at(-1) : undefined;

  return part?.type === "text" && part.text.trim() ? "success" : "running";
};

export const activityFailures = (
  entries: readonly TurnMessage[],
  tools: Record<string, ToolView>,
) => {
  const callIds = new Set(
    entries.flatMap(({ message }) =>
      message.role === "toolResult"
        ? [message.toolCallId]
        : message.content.filter((part) => part.type === "toolCall").map((part) => part.id),
    ),
  );

  return [...callIds].filter((id) => tools[id]?.status === "error").length;
};
