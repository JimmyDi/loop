import { memo } from "react";

import type { Message, ToolView, PromptTiming } from "../../../shared/protocol";
import { messageText } from "../../../shared/message-text";
import { AssistantContent } from "./AssistantContent";
import { MessageFooter } from "./MessageFooter";
import { PromptDuration } from "./PromptDuration";
import "./AssistantMessage.css";

const AssistantMessageView = ({
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

export const AssistantMessage = memo(AssistantMessageView, (previous, next) => {
  if (
    previous.message !== next.message ||
    previous.streaming !== next.streaming ||
    previous.generating !== next.generating ||
    previous.showFooter !== next.showFooter ||
    previous.timing !== next.timing ||
    previous.hideError !== next.hideError
  )
    return false;
  return previous.message.content.every(
    (part) => part.type !== "toolCall" || previous.tools[part.id] === next.tools[part.id],
  );
});
