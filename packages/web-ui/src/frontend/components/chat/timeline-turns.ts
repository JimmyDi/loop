import type { Message } from "../../../shared/protocol";

export type TurnMessage = { index: number; message: Exclude<Message, { role: "user" }> };

export type TimelineTurn =
  | { type: "user"; index: number; message: Extract<Message, { role: "user" }> }
  | {
      type: "assistant";
      index: number;
      userMessageIndex?: number;
      messages: TurnMessage[];
    };

export const groupTimelineTurns = (
  messages: readonly Message[],
  breakBefore?: number,
): TimelineTurn[] => {
  const turns: TimelineTurn[] = [];
  let userMessageIndex: number | undefined;

  for (const [index, message] of messages.entries()) {
    if (message.role === "user") {
      turns.push({ type: "user", index, message });
      userMessageIndex = index;
      continue;
    }

    const previous = turns.at(-1);

    if (previous?.type === "assistant" && index !== breakBefore)
      previous.messages.push({ index, message });
    else
      turns.push({
        type: "assistant",
        index,
        userMessageIndex,
        messages: [{ index, message }],
      });
  }

  return turns;
};

/** Keep visible content in history order, merging paired results into their tool rows. */
export const projectAssistantTurn = (messages: readonly TurnMessage[]): TurnMessage[] => {
  const calls = new Set(
    messages.flatMap(({ message }) =>
      message.role === "assistant"
        ? message.content.filter((part) => part.type === "toolCall").map((part) => part.id)
        : [],
    ),
  );

  return messages.filter(({ message }) =>
    message.role === "toolResult"
      ? !calls.has(message.toolCallId)
      : Boolean(message.errorMessage) ||
        message.content.some(
          (part) => part.type === "toolCall" || (part.type === "text" && part.text.trim()),
        ),
  );
};
