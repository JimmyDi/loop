import { EchoAvatar } from "./EchoAvatar";
import "./EchoConversationCard.css";

export const EchoConversationCard = ({
  name,
  avatar,
  group,
  preview,
  updatedAt,
  selected = false,
  onClick,
}: {
  name: string;
  avatar?: string;
  group?: boolean;
  preview?: string;
  updatedAt?: string;
  selected?: boolean;
  onClick(): void;
}) => (
  <button
    className="echo-conversation-card"
    type="button"
    aria-pressed={selected}
    onClick={onClick}
  >
    <EchoAvatar avatar={avatar} group={group} />
    <span className="echo-card-content">
      <span className="echo-card-heading">
        <strong>{name}</strong>
        {updatedAt && (
          <time dateTime={updatedAt}>
            {new Date(updatedAt).toLocaleDateString(undefined, {
              month: "numeric",
              day: "numeric",
            })}
          </time>
        )}
      </span>
      {preview && <span className="echo-card-preview">{preview}</span>}
    </span>
  </button>
);
