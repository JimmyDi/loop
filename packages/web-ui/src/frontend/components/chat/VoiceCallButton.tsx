import { useTranslation } from "react-i18next";

import { ActionButton } from "../ui/ActionButton";
import type { VoiceCallButtonProps } from "./voice-call-button-types";
import { VoiceSetupHint } from "./VoiceSetupHint";
import "./VoiceCallButton.css";

export const VoiceCallButton = ({ control }: VoiceCallButtonProps) => {
  const { t } = useTranslation();
  const setupRequired = !control.setupComplete;
  return (
    <VoiceSetupHint required={setupRequired}>
      <ActionButton
        className="voice-call-button icon ghost"
        title={t(setupRequired ? "voice.setupRequired" : "voice.conversation")}
        aria-label={t("voice.call")}
        aria-pressed={control.voice.mode === "conversation"}
        disabled={setupRequired || control.blocked || control.editing || !!control.voice.mode}
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
      </ActionButton>
    </VoiceSetupHint>
  );
};
