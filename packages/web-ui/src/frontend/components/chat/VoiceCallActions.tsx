import { useTranslation } from "react-i18next";

import { ActionButton } from "../ui/ActionButton";
import type { VoiceCallProps } from "./voice-call-types";
import { VoiceSetupHint } from "./VoiceSetupHint";
import "./VoiceCallActions.css";

export const VoiceCallActions = ({ control, running }: VoiceCallProps) => {
  const { t } = useTranslation();
  const { voice } = control;
  const paused = voice.status === "paused";
  const busy = voice.status === "connecting" || voice.status === "reconnecting";
  return (
    <div className="voice-call-actions">
      {paused ? (
        <VoiceSetupHint required={!control.setupComplete}>
          <ActionButton
            disabled={control.blocked || !control.setupComplete}
            title={!control.setupComplete ? t("voice.setupRequired") : undefined}
            onClick={() => control.start(voice.mode === "dictation" ? "dictation" : "conversation")}
          >
            {t("voice.resume")}
          </ActionButton>
        </VoiceSetupHint>
      ) : (
        <>
          <ActionButton disabled={busy} onClick={() => voice.mute(!voice.muted)}>
            {t(voice.muted ? "voice.unmute" : "voice.mute")}
          </ActionButton>
          {voice.mode === "conversation" && (
            <ActionButton disabled={busy} onClick={() => voice.pauseReading(!voice.readingPaused)}>
              {t(voice.readingPaused ? "voice.resumeReading" : "voice.pauseReading")}
            </ActionButton>
          )}
        </>
      )}
      {voice.mode === "conversation" && (
        <ActionButton
          className="ghost"
          disabled={control.blocked || control.editing}
          aria-pressed={control.steering}
          onClick={() => control.setSteering(!control.steering)}
        >
          {t(control.steering ? "voice.steering" : "voice.steer")}
        </ActionButton>
      )}
      {running && <ActionButton onClick={control.stopTask}>{t("voice.stopTask")}</ActionButton>}
      <ActionButton
        className="voice-hangup"
        onClick={() => void (voice.mode === "dictation" ? voice.endInput() : voice.stop())}
      >
        {t(voice.mode === "dictation" ? "voice.stopInput" : "voice.hangup")}
      </ActionButton>
    </div>
  );
};
