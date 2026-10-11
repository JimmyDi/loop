import type { Message, ToolView, PromptTiming } from "../../../shared/protocol";
import { messageText } from "../../../shared/message-text";
import { AssistantContent } from "./AssistantContent";
import { MessageFooter } from "./MessageFooter";
import { PromptDuration } from "./PromptDuration";
import "./AssistantMessage.css";

export const AssistantMessage = ({
  message,
  tools,
  streaming = false,
  generating = streaming,
  showFooter = true,
  timing,
  hideError = false,
}: {
  message: Extract<Message, { role: "assistant" }>;
  tools: Record<string, ToolView>;
  streaming?: boolean;
  generating?: boolean;
  showFooter?: boolean;
  timing?: PromptTiming;
  hideError?: boolean;
}) => (
  <article className="assistant-message" aria-busy={streaming}>
    {timing && <PromptDuration timing={timing} />}
    <div className="assistant-body">
      <AssistantContent
        message={message}
        tools={tools}
        streaming={streaming}
        generating={generating}
        hideError={hideError}
      />
      {!streaming && showFooter && (
        <MessageFooter
          timestamp={message.timestamp}
          text={messageText(message)}
          messageRole="assistant"
        />
      )}
    </div>
  </article>
);
