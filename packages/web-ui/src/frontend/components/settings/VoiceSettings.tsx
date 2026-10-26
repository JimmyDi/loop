import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { useVoiceSettings } from "../../hooks/useVoiceSettings";
import { useVoiceSetup } from "../../hooks/useVoiceSetup";
import { voiceProfileInstalled, voiceSetupActivity } from "./voice-setup-progress";
import { VoiceProfileStep } from "./VoiceProfileStep";
import { VoiceResourceStep } from "./VoiceResourceStep";
import { VoiceTestStep } from "./VoiceTestStep";
import "./VoiceSettings.css";

export const VoiceSettings = () => {
  const { t } = useTranslation();
  const settings = useVoiceSettings();
  const setup = useVoiceSetup();
  const { profile, setProfile } = setup;
  const { query, pending, requested } = settings;
  const status = query.data;
  const active = !!voiceSetupActivity(status, requested);
  const ready =
    !active &&
    !pending &&
    !settings.error &&
    !query.isError &&
    status?.supported === true &&
    status.phase === "idle" &&
    !status.error &&
    voiceProfileInstalled(status, profile);
  const verify = useCallback(() => {
    if (ready) setup.verify();
  }, [ready, setup.verify]);
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
          key={setup.signature ?? profile + ":" + ready}
          ready={ready}
          speechReady={status?.ttsInstalled === true}
          verified={setup.complete}
          onVerified={verify}
          onReset={setup.clearVerification}
        />
      </ol>
    </div>
  );
};
