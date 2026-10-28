import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { ActionButton } from "../ui/ActionButton";
import { VoiceSampleWaveform } from "../voice/VoiceSampleWaveform";
import { VoiceCallActions } from "./VoiceCallActions";
import type { VoiceInputButtonProps } from "./voice-input-button-types";
import "./ComposerVoiceCall.css";

export const ComposerVoiceCall = ({ control }: VoiceInputButtonProps) => {
  const { t } = useTranslation();
  const { voice } = control;
  const connecting = ["connecting", "reconnecting"].includes(voice.status);
  const active = !connecting && voice.status !== "paused" && !voice.muted;
  return (
    <div className="composer-voice-call" data-connecting={connecting}>
      <span className="composer-voice-call-status" role="status">
        {t("voice." + voice.status)}
      </span>
      <VoiceCallActions control={control} />
      {connecting ? (
        <svg
          className="composer-voice-call-wait"
          viewBox="0 0 240 32"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {Array.from({ length: 60 }, (_, index) => (
            <line
              key={index}
              x1={index * 4 + 2}
              x2={index * 4 + 2}
              y1="12"
              y2="20"
              style={{ "--wave-delay": index * -0.07 + "s" } as CSSProperties}
            />
          ))}
        </svg>
      ) : (
        <VoiceSampleWaveform
          samples={active ? (control.callSamples ?? []) : []}
          active={active}
          dense
        />
      )}
      <ActionButton
        className="icon ghost composer-voice-call-stop"
        aria-label={t("voice.hangup")}
        title={t("voice.hangup")}
        onClick={() => void voice.stop()}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      </ActionButton>
    </div>
  );
};
