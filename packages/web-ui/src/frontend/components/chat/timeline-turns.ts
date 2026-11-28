import type { Message } from "../../../shared/protocol";

export type TurnMessage = {
  index: number;
  message: Extract<Message, { role: "assistant" | "toolResult" }>;
};

export const onlyToolCalls = ({ message }: TurnMessage) =>
  message.role === "assistant" &&
  !message.errorMessage &&
  message.content.length > 0 &&
  message.content.every((part) => part.type === "toolCall" && part.name !== "submit_plan");

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
  breakBefore?: number | readonly number[],
): TimelineTurn[] => {
  const turns: TimelineTurn[] = [];
  const breaks = new Set(typeof breakBefore === "number" ? [breakBefore] : breakBefore);
  let userMessageIndex: number | undefined;

  for (const [index, message] of messages.entries()) {
    if (message.role === "system") continue;

    if (message.role === "user") {
      turns.push({ type: "user", index, message });
      userMessageIndex = index;
      continue;
    }

    const previous = turns.at(-1);

    if (previous?.type === "assistant" && !breaks.has(index))
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

export const appendTimelineDraft = (
  turns: readonly TimelineTurn[],
  entry: TurnMessage,
  userMessageIndex: number | undefined,
  breakBefore: boolean,
): TimelineTurn[] => {
  const tail = turns.at(-1);
  if (tail?.type === "assistant" && !breakBefore) {
    return [...turns.slice(0, -1), { ...tail, messages: [...tail.messages, entry] }];
  }
  return [...turns, { type: "assistant", index: entry.index, userMessageIndex, messages: [entry] }];
};

// Turn message arrays are immutable after grouping and shared across draft updates.
const assistantEntries = new WeakMap<readonly TurnMessage[], TurnMessage[]>();

/** Keep visible content in history order, merging paired results into their tool rows. */
export const projectAssistantTurn = (messages: readonly TurnMessage[]): TurnMessage[] => {
  const cached = assistantEntries.get(messages);
  if (cached) return cached;

  const calls = new Set(
    messages.flatMap(({ message }) =>
      message.role === "assistant"
        ? message.content.filter((part) => part.type === "toolCall").map((part) => part.id)
        : [],
    ),
  );

  const entries = messages.filter(({ message }) =>
    message.role === "toolResult"
      ? !calls.has(message.toolCallId)
      : Boolean(message.errorMessage) ||
        message.content.some(
          (part) => part.type === "toolCall" || (part.type === "text" && part.text.trim()),
        ),
  );
  assistantEntries.set(messages, entries);
  return entries;
};
