import type { Message } from "./protocol";

export const messageText = (message: Message): string => {
  if (typeof message.content === "string") return message.content;

  return message.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
};
