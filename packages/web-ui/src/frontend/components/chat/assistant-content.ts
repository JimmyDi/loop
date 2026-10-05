import type { Message } from "../../../shared/protocol";

type Content = Extract<Message, { role: "assistant" }>["content"];

export type AssistantBlock =
  | { type: "text"; key: string; text: string }
  | { type: "thinking"; key: string; thinking: string }
  | {
      type: "tools";
      key: string;
      calls: Extract<Content[number], { type: "toolCall" }>[];
      hasPreamble: boolean;
    };

export const groupAssistantContent = (content: Content): AssistantBlock[] => {
  const blocks: AssistantBlock[] = [];
  let hasPreamble = false;

  for (const [index, part] of content.entries()) {
    if (part.type === "toolCall") {
      const previous = blocks.at(-1);

      if (previous?.type === "tools") {
        previous.calls.push(part);
      } else {
        blocks.push({ type: "tools", key: `tools:${part.id}`, calls: [part], hasPreamble });
        hasPreamble = false;
      }
    } else if (part.type === "text") {
      const { text } = part;
      blocks.push({ type: "text", key: `text:${index}`, text });
      hasPreamble ||= Boolean(text.trim());
    } else if (part.type === "thinking") {
      blocks.push({ type: "thinking", key: `thinking:${index}`, thinking: part.thinking });
    }
  }

  return blocks;
};
