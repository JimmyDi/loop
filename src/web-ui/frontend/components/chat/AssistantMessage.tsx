import type { Message, ToolView } from "../../../shared/protocol";
import { messageText } from "../../../shared/message-text";
import { CopyButton } from "../ui/CopyButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { MarkdownText } from "./MarkdownText";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolCard } from "./ToolCard";
import "./AssistantMessage.css";

export const AssistantMessage = ({
  message,
  tools,
  streaming = false,
}: {
  message: Extract<Message, { role: "assistant" }>;
  tools: Record<string, ToolView>;
  streaming?: boolean;
}) => (
  <article className="assistant-message" aria-busy={streaming}>
    <span className="assistant-avatar" aria-hidden="true">
      ∞
    </span>
    <div className="assistant-body">
      {message.content.map((part, index) => {
        if (part.type === "text") return <MarkdownText key={index} text={part.text} />;

        if (part.type === "thinking") return <ThinkingBlock key={index} text={part.thinking} />;

        if (part.type === "toolCall")
          return (
            <ToolCard
              key={part.id}
              tool={
                tools[part.id] ?? {
                  id: part.id,
                  name: part.name,
                  args: part.arguments,
                  status: "waiting",
                }
              }
            />
          );

        return null;
      })}
      {!streaming && <ErrorNotice error={message.errorMessage} />}
      {!streaming && messageText(message) && <CopyButton text={messageText(message)} />}
    </div>
  </article>
);
