import { useTranslation } from "react-i18next";

import { CopyButton } from "../ui/CopyButton";
import "./MessageFooter.css";

export const MessageFooter = ({
  timestamp,
  text,
  messageRole,
}: {
  timestamp: number;
  text: string;
  messageRole: "user" | "assistant";
}) => {
  const { t, i18n } = useTranslation();
  const date = new Date(timestamp);

  return (
    <footer className="message-footer">
      {Number.isFinite(date.getTime()) && (
        <time dateTime={date.toISOString()} title={date.toLocaleString(i18n.language)}>
          {date.toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" })}
        </time>
      )}
      {text && (
        <CopyButton
          text={text}
          label={t(messageRole === "user" ? "copyMessage" : "copyResponse")}
        />
      )}
    </footer>
  );
};
