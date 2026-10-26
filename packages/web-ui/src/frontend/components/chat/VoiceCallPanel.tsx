import { useTranslation } from "react-i18next";

import { ActionButton } from "../ui/ActionButton";
import { VoiceCallActions } from "./VoiceCallActions";
import type { VoiceCallProps } from "./voice-call-types";
import "./VoiceCallPanel.css";

export const VoiceCallPanel = ({ control, running }: VoiceCallProps) => {
  const { t } = useTranslation();
  const { voice } = control;
  const paused = voice.status === "paused";
  const busy = voice.status === "connecting" || voice.status === "reconnecting";
  return (
    <div
      className="voice-call"
      role="region"
      aria-label={t(voice.mode === "dictation" ? "voice.dictation" : "voice.conversation")}
    >
      <div className="voice-call-heading">
        <span
          className="voice-activity"
          aria-hidden="true"
          data-listening={!voice.muted && !paused && !busy}
        />
        <span role="status">
          {t(voice.muted && !paused ? "voice.muted" : "voice." + voice.status)}
        </span>
        {voice.mode === "conversation" && (
          <span className="voice-task-status">
            {t(running ? "voice.taskRunning" : "voice.taskIdle")}
          </span>
        )}
      </div>
      {voice.text && (
        <div className="voice-transcript-row">
          <p className="voice-transcript" aria-label={t("voice.partial")}>
            {voice.text}
          </p>
          {voice.mode === "conversation" && (
            <ActionButton
              className="ghost"
              disabled={control.editing}
              onClick={control.editTranscript}
            >
              {t("voice.editTranscript")}
            </ActionButton>
          )}
        </div>
      )}
      <VoiceCallActions control={control} running={running} />
      {voice.mode === "conversation" && (
        <small>{t(control.editing ? "voice.editing" : "voice.draftProtected")}</small>
      )}
    </div>
  );
};
