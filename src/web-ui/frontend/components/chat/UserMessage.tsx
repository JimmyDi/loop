import type { Message } from "../../../shared/protocol";
import { messageText } from "../../../shared/message-text";
import { CopyButton } from "../ui/CopyButton";
import "./UserMessage.css";

export const UserMessage = ({ message }: { message: Extract<Message, { role: "user" }> }) => {
  const text = messageText(message);

  return (
    <article className="user-message">
      <div>{text}</div>
      <CopyButton text={text} />
    </article>
  );
};
