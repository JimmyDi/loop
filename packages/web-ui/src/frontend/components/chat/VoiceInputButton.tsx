import { useTranslation } from "react-i18next";

import { ActionButton } from "../ui/ActionButton";
import type { VoiceInputButtonProps } from "./voice-input-button-types";
import { VoiceSetupHint } from "./VoiceSetupHint";
import "./VoiceInputButton.css";

export const VoiceInputButton = ({ control }: VoiceInputButtonProps) => {
  const { t } = useTranslation();
  const { voice } = control;
  const active = voice.mode === "dictation";
  const paused = active && voice.status === "paused";
  const label = t(paused ? "voice.resume" : active ? "voice.stopInput" : "voice.dictation");
  const setupRequired = !control.setupComplete && (!active || paused);
  return (
    <VoiceSetupHint required={setupRequired}>
      <ActionButton
        className="voice-input-button icon ghost"
        title={setupRequired ? t("voice.setupRequired") : label}
        aria-label={label}
        aria-pressed={active}
        disabled={
          setupRequired || voice.mode === "conversation" || ((!active || paused) && control.blocked)
        }
        onClick={() => {
          if (active && !paused) void voice.endInput();
          else control.start("dictation");
        }}
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
          <rect x="9" y="2" width="6" height="13" rx="3" />
          <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" />
        </svg>
      </ActionButton>
    </VoiceSetupHint>
  );
};
