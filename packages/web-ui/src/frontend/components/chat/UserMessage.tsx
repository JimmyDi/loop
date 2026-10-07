import type { Ref } from "react";
import { useTranslation } from "react-i18next";

import type { Message } from "../../../shared/protocol";
import type { LoadedSkill } from "../../../shared/skills";
import { messageText } from "../../../shared/message-text";
import { readFileContent } from "../../../shared/prompt-files";
import { IMAGE_TYPES } from "../../../shared/prompt-images";
import { copySkillMessage } from "../../lib/skill-clipboard";
import { MessageFooter } from "./MessageFooter";
import { TextFileAttachment } from "./TextFileAttachment";
import { UserMessageSkill } from "./UserMessageSkill";
import "./UserMessage.css";

export const UserMessage = ({
  message,
  skills = [],
  workspaceId,
  ref,
}: {
  message: Extract<Message, { role: "user" }>;
  skills?: Pick<LoadedSkill, "id" | "name" | "description">[];
  workspaceId?: string;
  ref?: Ref<HTMLElement>;
}) => {
  const parts = typeof message.content === "string" ? [] : message.content;
  const files = parts.flatMap((part) => {
    const file = part.type === "text" ? readFileContent(part.text) : undefined;
    return file ? [file] : [];
  });
  const text = messageText({
    ...message,
    content:
      typeof message.content === "string"
        ? message.content
        : parts.filter((part) => part.type !== "text" || !readFileContent(part.text)),
  });
  const { t } = useTranslation();
  const copied = copySkillMessage(text, skills);
  const images =
    typeof message.content === "string"
      ? []
      : message.content.filter(
          (part) => part.type === "image" && IMAGE_TYPES.includes(part.mimeType),
        );

  return (
    <article className="user-message" ref={ref}>
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
      {files.length > 0 && (
        <div className="user-files">
          {files.map((file, index) => (
            <TextFileAttachment key={index} file={file} variant="pill" />
          ))}
        </div>
      )}
      {(text || skills.length > 0) && (
        <div className="user-message-text">
          {skills.map((skill) => (
            <UserMessageSkill key={skill.id} skill={skill} workspaceId={workspaceId} />
          ))}
          {text}
        </div>
      )}
      <MessageFooter
        timestamp={message.timestamp}
        text={copied.text}
        html={copied.html}
        messageRole="user"
      />
    </article>
  );
};
