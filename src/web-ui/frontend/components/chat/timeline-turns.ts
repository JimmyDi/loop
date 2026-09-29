import type { Message } from "../../../shared/protocol";
import { readFileContent } from "../../../shared/prompt-files";
import { readAssistantText } from "../../../shared/assistant-text";

export type TurnMessage = { index: number; message: Exclude<Message, { role: "user" }> };

export type TimelineTurn =
  | { type: "user"; index: number; message: Extract<Message, { role: "user" }> }
  | {
      type: "assistant";
      index: number;
      userMessageIndex?: number;
      title: string;
      messages: TurnMessage[];
    };

export const groupTimelineTurns = (messages: readonly Message[]): TimelineTurn[] => {
  const turns: TimelineTurn[] = [];
  let title = "";
  let userMessageIndex: number | undefined;

  for (const [index, message] of messages.entries()) {
    if (message.role === "user") {
      turns.push({ type: "user", index, message });
      userMessageIndex = index;
      title = (
        typeof message.content === "string"
          ? message.content
          : message.content
              .filter((part) => part.type === "text" && !readFileContent(part.text))
              .map((part) => (part.type === "text" ? part.text : ""))
              .join(" ")
      )
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 90);
      continue;
    }

    const previous = turns.at(-1);

    if (previous?.type === "assistant") previous.messages.push({ index, message });
    else
      turns.push({
        type: "assistant",
        index,
        userMessageIndex,
        title,
        messages: [{ index, message }],
      });
  }

  return turns;
};

export const projectAssistantTurn = (messages: readonly TurnMessage[], draftIndex?: number) => {
  const activity: TurnMessage[] = [];
  const calls = new Set(
    messages.flatMap(({ message }) =>
      message.role === "assistant"
        ? message.content.filter((part) => part.type === "toolCall").map((part) => part.id)
        : [],
    ),
  );
  const last = messages.at(-1);
  let answer: { index: number; message: Extract<Message, { role: "assistant" }> } | undefined;

  for (const entry of messages) {
    const { message, index } = entry;

    if (message.role === "toolResult") {
      if (!calls.has(message.toolCallId)) activity.push(entry);
      continue;
    }

    const hasCalls = message.content.some((part) => part.type === "toolCall");

    const streaming = index === draftIndex;
    const intermediate =
      entry !== last || (!streaming && message.stopReason === "toolUse") || hasCalls;
    const steps: typeof message.content = [];
    const content: typeof message.content = [];

    for (const part of message.content) {
      if (part.type !== "text") {
        steps.push(part);
        continue;
      }
      const { text, phase } = readAssistantText(part, streaming);
      const visible = { ...part, text };
      if (phase === "commentary" || (phase !== "final_answer" && intermediate)) {
        steps.push(visible);
      } else if (phase === "final_answer" || !streaming) {
        content.push(visible);
      }
      // Unmarked drafts stay buffered instead of guessing a destination from their wording.
    }

    const hasAnswer = content.some((part) => part.type === "text" && part.text.trim());
    const activityError = intermediate && !hasAnswer ? message.errorMessage : undefined;
    if (steps.some((part) => part.type !== "text" || part.text.trim()) || activityError)
      activity.push({
        index,
        message: { ...message, content: steps, errorMessage: activityError },
      });

    if (hasAnswer || (message.errorMessage && !activityError && !streaming))
      answer = { index, message: { ...message, content } };
  }

  return { activity, answer };
};
