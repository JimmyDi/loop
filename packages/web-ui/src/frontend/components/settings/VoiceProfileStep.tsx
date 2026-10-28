import { useTranslation } from "react-i18next";

import type { VoiceProfileStepProps } from "./voice-profile-step-types";
import { VoiceProfileSelect } from "./VoiceProfileSelect";
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
      className="voice-profile-step"
      number={1}
      title={t("voice.chooseProfile")}
      complete={complete}
      loading={loading}
    >
      <div className="voice-profile-field">
        <span className="voice-profile-field-label">{t("voice.features")}</span>
        <VoiceProfileSelect profile={profile} disabled={disabled} onChange={onChange} />
      </div>
    </VoiceSetupStep>
  );
};
