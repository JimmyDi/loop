import { useTranslation } from "react-i18next";

import type { VoiceProfileSelectProps } from "./voice-profile-select-types";
import { VoiceSelect } from "./VoiceSelect";
import "./VoiceProfileSelect.css";

export const VoiceProfileSelect = ({ profile, disabled, onChange }: VoiceProfileSelectProps) => {
  const { t } = useTranslation();
  return (
    <VoiceSelect
      label={t("voice.chooseProfile")}
      value={profile}
      disabled={disabled}
      options={[
        { value: "input", name: t("voice.inputProfile"), description: t("voice.inputProfileHint") },
        {
          value: "conversation",
          name: t("voice.conversationProfile"),
          description: t("voice.conversationProfileHint"),
        },
      ]}
      onChange={(value) => {
        if (value === "input" || value === "conversation") onChange(value);
      }}
    />
  );
};
