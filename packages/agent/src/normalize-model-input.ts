import type { Api, Message, Model } from "@earendil-works/pi-ai";
import { transformMessages } from "@earendil-works/pi-ai/api/transform-messages";

import type { ModelMessageSource } from "./types";

/** Carry indexes through the runtime's transforms without identifying messages by content. */
export const normalizeModelInput = (
  history: readonly Message[],
  model: Model<Api>,
): { messages: Message[]; sources: ModelMessageSource[] } => {
  const origin = Symbol("history index");
  type TrackedMessage = Message & { [origin]?: number };
  const tracked: TrackedMessage[] = structuredClone([...history]);
  tracked.forEach((message, index) => {
    message[origin] = index;
  });
  const messages: TrackedMessage[] = transformMessages(tracked, model);
  const sources: ModelMessageSource[] = [];
  const calls = new Map<string, number>();

  for (const message of messages) {
    const messageIndex = message[origin];
    delete message[origin];
    if (messageIndex !== undefined) {
      sources.push({ type: "history", messageIndex });
      if (message.role === "assistant") {
        calls.clear();
        for (const block of message.content) {
          if (block.type === "toolCall") calls.set(block.id, messageIndex);
        }
      } else if (message.role === "user") {
        calls.clear();
      }
      continue;
    }
    const callIndex = message.role === "toolResult" ? calls.get(message.toolCallId) : undefined;
    if (message.role !== "toolResult" || callIndex === undefined)
      throw new Error("Model input normalization lost its message origin");
    sources.push({ type: "tool-repair", messageIndex: callIndex, toolCallId: message.toolCallId });
  }

  return { messages, sources };
};
