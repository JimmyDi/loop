import type { Message } from "../types";

type MessageItemProps = {
  message: Message;
  index: number;
};

export function MessageItem({ message, index }: MessageItemProps) {
  return (
    <article className={`message ${message.kind}`} key={`${message.kind}-${index}`}>
      {message.text}
    </article>
  );
}
