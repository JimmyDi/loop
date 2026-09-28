import type { Message } from "../../../shared/protocol";
import { messageText } from "../../../shared/message-text";
import { CopyButton } from "../ui/CopyButton";
import { useTranslation } from "react-i18next";
import { IMAGE_TYPES } from "../../../shared/prompt-images";
import "./UserMessage.css";

export const UserMessage = ({ message }: { message: Extract<Message, { role: "user" }> }) => {
  const text = messageText(message);
  const { t } = useTranslation();
  const images =
    typeof message.content === "string"
      ? []
      : message.content.filter(
          (part) => part.type === "image" && IMAGE_TYPES.includes(part.mimeType),
        );

  return (
    <article className="user-message">
      {images.length > 0 && (
        <div className="user-images">
          {images.map(
            (image, index) =>
              image.type === "image" && (
                <img
                  key={index}
                  src={"data:" + image.mimeType + ";base64," + image.data}
                  alt={t("imageAttachment", { index: index + 1 })}
                  loading="lazy"
                />
              ),
          )}
        </div>
      )}
      {text && <div>{text}</div>}
      {text && <CopyButton text={text} />}
    </article>
  );
};
