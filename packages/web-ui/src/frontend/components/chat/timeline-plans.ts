import type { SessionSnapshot } from "../../../shared/protocol";
import type { TurnMessage } from "./timeline-turns";

/** Match persisted plans to successful submission results in this history row. */
export const plansForTimelineEntry = (
  entry: TurnMessage,
  messages: readonly TurnMessage[],
  plans: NonNullable<SessionSnapshot["state"]["planning"]>["plans"],
) => {
  const calls = new Set(
    entry.message.role === "assistant"
      ? entry.message.content.flatMap((part) =>
          part.type === "toolCall" && part.name === "submit_plan" ? [part.id] : [],
        )
      : [entry.message.toolCallId],
  );
  const ids = new Set<string>();
  for (const { message } of messages) {
    if (
      message.role !== "toolResult" ||
      message.toolName !== "submit_plan" ||
      message.isError ||
      !calls.has(message.toolCallId)
    )
      continue;
    for (const part of message.content) {
      if (part.type !== "text") continue;
      try {
        const result: unknown = JSON.parse(part.text);
        if (result && typeof result === "object" && "id" in result && typeof result.id === "string")
          ids.add(result.id);
      } catch {
        // Interrupted or legacy results without a saved plan cannot anchor a card.
      }
    }
  }
  return plans.filter((plan) => ids.has(plan.id));
};
