import { useTranslation } from "react-i18next";

import { voiceErrorKey } from "../../voice/errors";
import { ActionButton } from "../ui/ActionButton";
import type { VoiceResourceStepProps } from "./voice-resource-step-types";
import { voiceProfileInstalled, voiceSetupActivity } from "./voice-setup-progress";
import { VoiceDownloadProgress } from "./VoiceDownloadProgress";
import { VoiceResourceActions } from "./VoiceResourceActions";
import { VoiceResourceList } from "./VoiceResourceList";
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
  const failure = error || status?.error;
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
      number={2}
      title={t("voice.installResources")}
      complete={installed && !query.isError}
      loading={query.isPending || (query.isError && query.isFetching) || active}
      failed={!!issue && status?.localManagement !== false}
      issue={issue}
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
      progress={active && <VoiceDownloadProgress download={status?.download} activity={activity} />}
    >
      {installed && <small className="voice-resource-hint">{t("voice.repairHint")}</small>}
      <details className="voice-resource-details">
        <summary>{t("voice.resourceDetails")}</summary>
        <div className="voice-resource-details-content">
          {status?.version && <small>{status.version}</small>}
          {status?.directory && status.localManagement && (
            <code className="voice-directory">{status.directory}</code>
          )}
          <VoiceResourceList components={status?.components} />
        </div>
      </details>
      {query.isError && (
        <ActionButton disabled={query.isFetching} onClick={() => void query.refetch()}>
          {t("voice.retry")}
        </ActionButton>
      )}
    </VoiceSetupStep>
  );
};
