import type { Message, ToolView } from "../../../shared/protocol";
import { messageText } from "../../../shared/message-text";
import { LoopIcon } from "../ui/LoopIcon";
import { AssistantContent } from "./AssistantContent";
import { MessageFooter } from "./MessageFooter";
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
    {!streaming && <LoopIcon className="assistant-avatar" />}
    <div className="assistant-body">
      <AssistantContent message={message} tools={tools} streaming={streaming} />
      {!streaming && (
        <MessageFooter
          timestamp={message.timestamp}
          text={messageText(message)}
          messageRole="assistant"
        />
      )}
    </div>
  </article>
);
