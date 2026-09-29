import type { Message } from "./protocol";
import { readAssistantText } from "./assistant-text";

export const messageText = (message: Message): string => {
  if (typeof message.content === "string") return message.content;

  return message.content
    .filter((part) => part.type === "text")
    .map((part) => (message.role === "assistant" ? readAssistantText(part).text : part.text))
    .join("\n");
};
