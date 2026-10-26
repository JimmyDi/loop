import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { VoiceProfile } from "../../../shared/voice";
import { useVoiceSettings } from "../../hooks/useVoiceSettings";
import { voiceProfileInstalled, voiceSetupActivity } from "./voice-setup-progress";
import { VoiceProfileStep } from "./VoiceProfileStep";
import { VoiceResourceStep } from "./VoiceResourceStep";
import { VoiceTestStep } from "./VoiceTestStep";
import "./VoiceSettings.css";

export const VoiceSettings = () => {
  const { t } = useTranslation();
  const settings = useVoiceSettings();
  const [profile, setProfile] = useState<VoiceProfile>("conversation");
  const { query, pending, requested } = settings;
  const status = query.data;
  const active = !!voiceSetupActivity(status, requested);
  const ready = !active && !pending && !query.isError && voiceProfileInstalled(status, profile);
  return (
    <div className="voice-settings">
      <h3 className="settings-section-title">{t("voice.title")}</h3>
      <p>{t("voice.privacy")}</p>
      <ol className="voice-setup-steps" aria-label={t("voice.steps")}>
        <VoiceProfileStep
          profile={profile}
          disabled={pending || active || !query.isSuccess || !status?.supported}
          complete={query.isSuccess && !!status?.supported}
          loading={query.isPending || (query.isError && query.isFetching)}
          onChange={setProfile}
        />
        <VoiceResourceStep settings={settings} profile={profile} />
        <VoiceTestStep
          key={profile + ":" + status?.version + ":" + ready}
          ready={ready}
          speechReady={status?.ttsInstalled === true}
        />
      </ol>
    </div>
  );
};
