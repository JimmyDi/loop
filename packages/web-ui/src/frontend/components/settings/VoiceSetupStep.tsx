import { useTranslation } from "react-i18next";

import { SetupStepMarker } from "../ui/SetupStepMarker";
import type { VoiceSetupStepProps } from "./voice-setup-step-types";
import "./VoiceSetupStep.css";

export const VoiceSetupStep = ({
  className,
  number,
  title,
  complete,
  loading = false,
  failed = false,
  actions,
  progress,
  issue,
  children,
}: VoiceSetupStepProps) => {
  const { t } = useTranslation();
  const state = loading
    ? "loading"
    : failed
      ? "checkFailed"
      : complete
        ? "completed"
        : "incomplete";
  return (
    <li
      className={["voice-setup-step", className].filter(Boolean).join(" ")}
      data-complete={complete && !loading && !failed}
    >
      <SetupStepMarker
        complete={complete}
        loading={loading}
        failed={failed}
        label={t("voice." + state)}
      />
      <div className="voice-setup-step-content">
        <div className="voice-setup-step-heading">
          <span className="voice-setup-step-number">{t("voice.step", { number })}</span>
          <h4 title={title}>{title}</h4>
          {actions}
          {progress}
          {issue && (
            <p className="voice-setup-step-issue" role="alert">
              {issue}
            </p>
          )}
        </div>
        <div className="voice-setup-step-detail">{children}</div>
      </div>
    </li>
  );
};
