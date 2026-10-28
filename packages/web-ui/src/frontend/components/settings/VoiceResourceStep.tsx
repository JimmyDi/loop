import { useTranslation } from "react-i18next";

import { voiceErrorKey } from "../../voice/errors";
import { ActionButton } from "../ui/ActionButton";
import type { VoiceResourceStepProps } from "./voice-resource-step-types";
import { voiceProfileInstalled, voiceSetupActivity } from "./voice-setup-progress";
import { VoiceResourceActions } from "./VoiceResourceActions";
import { VoiceResourcePackages } from "./VoiceResourcePackages";
import { VoiceSetupStep } from "./VoiceSetupStep";
import "./VoiceResourceStep.css";

export const VoiceResourceStep = ({ settings, profile }: VoiceResourceStepProps) => {
  const { t } = useTranslation();
  const { query, execute, pending, requested, error } = settings;
  const status = query.data;
  const activity = voiceSetupActivity(status, requested);
  const active = !!activity;
  const disabled =
    pending || query.isPending || query.isError || !status?.supported || !status.localManagement;
  const failure = status?.phase === "paused" ? undefined : error || status?.error;
  const errorKey = voiceErrorKey(failure);
  const issue = query.isError
    ? t("voice.settingsFailed")
    : status?.supported === false
      ? t("voice.unsupported")
      : status?.localManagement === false
        ? t("voice.remoteManagement")
        : status?.engineAvailable === false
          ? t("voice.engineUnavailable")
          : failure
            ? t(errorKey === "voice.failed" ? "voice.installFailed" : errorKey)
            : undefined;
  const installed = voiceProfileInstalled(status, profile);
  return (
    <VoiceSetupStep
      className="voice-resource-step"
      number={2}
      title={t("voice.installResources")}
      complete={installed && !query.isError}
      loading={query.isPending || (query.isError && query.isFetching) || active}
      failed={!!issue && status?.localManagement !== false}
      actions={
        <VoiceResourceActions
          status={status}
          profile={profile}
          disabled={disabled}
          pending={pending}
          active={active}
          cancellable={activity === "installing" || activity === "updating"}
          loaded={query.isSuccess}
          execute={execute}
        />
      }
    >
      <div className="voice-resource-summary">
        <VoiceResourcePackages status={status} />
      </div>
      {issue && (
        <p className="voice-resource-issue" role="alert">
          {issue}
        </p>
      )}
      {query.isError && (
        <ActionButton disabled={query.isFetching} onClick={() => void query.refetch()}>
          {t("voice.retry")}
        </ActionButton>
      )}
    </VoiceSetupStep>
  );
};
