import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../../shared/protocol";
import { useAutoScroll } from "../../hooks/useAutoScroll";
import { ActionButton } from "../ui/ActionButton";
import { AssistantMessage } from "./AssistantMessage";
import { UserMessage } from "./UserMessage";
import { ToolCard } from "./ToolCard";
import "./MessageTimeline.css";

export const MessageTimeline = ({ snapshot }: { snapshot: SessionSnapshot }) => {
  const { t } = useTranslation();
  const scroll = useAutoScroll(snapshot);
  const messages = [...snapshot.state.messages];

  if (snapshot.state.draft) messages[snapshot.draftIndex ?? messages.length] = snapshot.state.draft;

  const calls = new Set(
    messages.flatMap((message) =>
      message.role === "assistant"
        ? message.content.filter((part) => part.type === "toolCall").map((part) => part.id)
        : [],
    ),
  );

  return (
    <div className="timeline-region">
      <div
        className="message-timeline"
        ref={scroll.ref}
        onScroll={scroll.onScroll}
        role="log"
        aria-live="off"
      >
        <div className="timeline-content">
          {!messages.length && <p className="timeline-empty">{t("emptySession")}</p>}
          {messages.map((message, index) => {
            if (message.role === "user") return <UserMessage key={index} message={message} />;

            if (message.role === "assistant")
              return (
                <AssistantMessage
                  key={index}
                  message={message}
                  tools={snapshot.tools}
                  streaming={snapshot.draftIndex === index}
                />
              );

            return !calls.has(message.toolCallId) && snapshot.tools[message.toolCallId] ? (
              <ToolCard key={index} tool={snapshot.tools[message.toolCallId]!} />
            ) : null;
          })}
        </div>
      </div>
      {!scroll.atBottom && (
        <ActionButton className="jump-latest" onClick={scroll.jump}>
          {t("scrollBottom")}
        </ActionButton>
      )}
    </div>
  );
};
