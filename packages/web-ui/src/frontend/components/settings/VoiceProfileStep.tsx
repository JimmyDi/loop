import { useTranslation } from "react-i18next";

import type { VoiceProfile } from "../../../shared/voice";
import type { VoiceProfileStepProps } from "./voice-profile-step-types";
import { VoiceSetupStep } from "./VoiceSetupStep";
import "./VoiceProfileStep.css";

export const VoiceProfileStep = ({
  profile,
  disabled,
  complete,
  loading,
  onChange,
}: VoiceProfileStepProps) => {
  const { t } = useTranslation();
  return (
    <VoiceSetupStep
      number={1}
      title={t("voice.chooseProfile")}
      complete={complete}
      loading={loading}
    >
      <label className="voice-profile">
        <span className="sr-only">{t("voice.chooseProfile")}</span>
        <select
          value={profile}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value as VoiceProfile)}
        >
          <option value="input">{t("voice.inputProfile")}</option>
          <option value="conversation">{t("voice.conversationProfile")}</option>
        </select>
      </label>
      <small className="voice-profile-hint">
        {t(profile === "input" ? "voice.inputProfileHint" : "voice.conversationProfileHint")}
      </small>
    </VoiceSetupStep>
  );
};
