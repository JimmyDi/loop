import { useTranslation } from "react-i18next";

import { ActionButton } from "../ui/ActionButton";
import type { VoiceCallButtonProps } from "./voice-call-button-types";
import "./VoiceCallButton.css";

export const VoiceCallButton = ({ control }: VoiceCallButtonProps) => {
  const { t } = useTranslation();
  return (
    <ActionButton
      className="voice-call-button ghost"
      title={t("voice.conversation")}
      aria-label={t("voice.call")}
      aria-pressed={control.voice.mode === "conversation"}
      disabled={control.blocked || control.editing || !!control.voice.mode}
      onClick={() => control.start("conversation")}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 12h2m3-5v10m4-14v18m4-14v10m3-5h2" />
      </svg>
      {t("voice.call")}
    </ActionButton>
  );
};
