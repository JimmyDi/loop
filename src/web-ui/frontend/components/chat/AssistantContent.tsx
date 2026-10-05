import type { Message, ToolView } from "../../../shared/protocol";
import { ErrorNotice } from "../ui/ErrorNotice";
import { MarkdownText } from "./MarkdownText";
import { ThinkingBlock } from "./ThinkingBlock";
import { groupAssistantContent } from "./assistant-content";
import { ToolGroup } from "./ToolGroup";

export const AssistantContent = ({
  message,
  tools,
  streaming = false,
}: {
  message: Extract<Message, { role: "assistant" }>;
  tools: Record<string, ToolView>;
  streaming?: boolean;
}) => (
  <>
    {groupAssistantContent(message.content).map((part) => {
      if (part.type === "text")
        return <MarkdownText key={part.key} text={part.text} streaming={streaming} />;

      if (part.type === "thinking") return <ThinkingBlock key={part.key} text={part.thinking} />;

      return (
        <ToolGroup
          key={part.key}
          hasPreamble={part.hasPreamble}
          tools={part.calls.map(
            (call) =>
              tools[call.id] ?? {
                id: call.id,
                name: call.name,
                args: call.arguments,
                status: "waiting",
              },
          )}
        />
      );
    })}
    {!streaming && <ErrorNotice error={message.errorMessage} />}
  </>
);
