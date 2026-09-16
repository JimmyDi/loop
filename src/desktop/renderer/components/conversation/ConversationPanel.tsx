import { MessageItem } from "./MessageItem";
import { WelcomeCard } from "./WelcomeCard";
import type { Message } from "../types";

type ConversationPanelProps = {
  messages: Message[];
};

export function ConversationPanel({ messages }: ConversationPanelProps) {
  return (
    <section className="conversation" aria-live="polite">
      {messages.length === 0 ? (
        <WelcomeCard />
      ) : (
        messages.map((message, index) => (
          <MessageItem key={`${message.kind}-${index}`} message={message} index={index} />
        ))
      )}
    </section>
  );
}
