import type { Message, ToolView } from "../../../shared/protocol";
import { messageText } from "../../../shared/message-text";
import { CopyButton } from "../ui/CopyButton";
import { AssistantContent } from "./AssistantContent";
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
    {!streaming && (
      <span className="assistant-avatar" aria-hidden="true">
        ∞
      </span>
    )}
    <div className="assistant-body">
      <AssistantContent message={message} tools={tools} streaming={streaming} />
      {!streaming && messageText(message) && <CopyButton text={messageText(message)} />}
    </div>
  </article>
);
