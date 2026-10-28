import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import type { VoiceInputButtonProps } from "./voice-input-button-types";
import "./ComposerVoiceOrb.css";

export const ComposerVoiceOrb = ({ control }: VoiceInputButtonProps) => {
  const { t } = useTranslation();
  const { voice, dictation } = control;
  const samples = voice.mode === "conversation" ? control.callSamples : dictation?.samples;
  const listening = ["listening", "transcribing"].includes(voice.status) && !voice.muted;
  const level = listening ? Math.min(1, (samples?.at(-1) ?? 0) / 0.15) : 0;
  return (
    <span
      className="composer-voice-orb"
      role="status"
      aria-label={t("voice." + voice.status)}
      data-status={voice.status}
      data-muted={voice.muted || undefined}
      style={{ "--voice-level": level } as CSSProperties}
    >
      <span className="composer-voice-orb-cloud" aria-hidden="true" />
    </span>
  );
};
