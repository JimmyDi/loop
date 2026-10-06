import type { Message, ToolView } from "../../../shared/protocol";
import { ErrorNotice } from "../ui/ErrorNotice";
import { MarkdownText } from "./MarkdownText";
import { groupAssistantContent } from "./assistant-content";
import { ToolGroup } from "./ToolGroup";

export const AssistantContent = ({
  message,
  tools,
  streaming = false,
  generating = false,
}: {
  message: Extract<Message, { role: "assistant" }>;
  tools: Record<string, ToolView>;
  streaming?: boolean;
  generating?: boolean;
}) => (
  <>
    {groupAssistantContent(message.content).map((part, index, blocks) => {
      if (part.type === "text")
        return <MarkdownText key={part.key} text={part.text} streaming={streaming} />;

      return (
        <ToolGroup
          key={part.key}
          generating={generating && index === blocks.length - 1}
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
