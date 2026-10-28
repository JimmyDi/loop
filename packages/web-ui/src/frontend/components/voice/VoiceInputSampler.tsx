import { useTranslation } from "react-i18next";

import { ActionButton } from "../ui/ActionButton";
import { VoiceSampleWaveform } from "./VoiceSampleWaveform";
import type { VoiceInputSamplerProps } from "./voice-input-sampler-types";
import "./VoiceInputSampler.css";

export const VoiceInputSampler = ({
  samples,
  dense,
  active,
  connecting,
  recording,
  remaining,
  onDiscard,
  onFinish,
}: VoiceInputSamplerProps) => {
  const { t } = useTranslation();
  return (
    <div className="voice-input-sampler">
      <div className="voice-input-sampler-capsule" data-active={active && !connecting}>
        <ActionButton
          className="icon ghost"
          disabled={!active || connecting}
          aria-label={t("voice.discardTest")}
          title={t("voice.discardTest")}
          onClick={onDiscard}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </ActionButton>
        <VoiceSampleWaveform samples={samples} active={recording} dense={dense} />
        <ActionButton
          className="icon ghost"
          disabled={!recording}
          aria-label={t("voice.stopTest")}
          title={t("voice.stopTest")}
          onClick={onFinish}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        </ActionButton>
      </div>
      <span className="voice-input-sampler-countdown">
        {recording && remaining !== undefined ? remaining + "S" : null}
      </span>
    </div>
  );
};
