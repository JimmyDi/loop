import type { Message } from "./protocol";
import { messageText } from "./message-text";
import { assistantTextPhase } from "./assistant-text-phase";
import { readFileContent } from "./prompt-files";

export type TimelinePreview = { index: number; user: string; reply: string };

/** Small plain-text summaries; tools, thinking and attachment payloads never enter previews. */
export const timelinePreviews = (messages: readonly Message[], offset = 0): TimelinePreview[] => {
  const previews: TimelinePreview[] = [];
  for (const [index, message] of messages.entries()) {
    if (message.role === "user") {
      const content =
        typeof message.content === "string"
          ? message.content
          : message.content.filter((part) => part.type !== "text" || !readFileContent(part.text));
      previews.push({
        index: index + offset,
        user: messageText({ ...message, content }).slice(0, 400),
        reply: "",
      });
    } else if (message.role === "assistant" && previews.length) {
      const text = message.content
        .filter(
          (part) => part.type === "text" && assistantTextPhase(part.textSignature) !== "commentary",
        )
        .map((part) => (part.type === "text" ? part.text : ""))
        .join("\n")
        .trim();
      if (text && !message.content.some((part) => part.type === "toolCall"))
        previews.at(-1)!.reply = text.length > 600 ? text.slice(0, 600) + "…" : text;
    }
  }
  return previews;
};

export type TimelineNavigation = { previews: TimelinePreview[]; bookmarks: number[] };
