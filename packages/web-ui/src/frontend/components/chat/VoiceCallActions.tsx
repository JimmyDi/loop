import { useTranslation } from "react-i18next";

import { ActionButton } from "../ui/ActionButton";
import type { VoiceInputButtonProps } from "./voice-input-button-types";
import { VoiceSetupHint } from "./VoiceSetupHint";
import "./VoiceCallActions.css";

export const VoiceCallActions = ({ control }: VoiceInputButtonProps) => {
  const { t } = useTranslation();
  const { voice } = control;
  const paused = voice.status === "paused";
  const busy = voice.status === "connecting" || voice.status === "reconnecting";
  const micLabel = t(paused ? "voice.resume" : voice.muted ? "voice.unmute" : "voice.mute");
  const readingLabel = t(voice.readingPaused ? "voice.resumeReading" : "voice.pauseReading");
  const steerLabel = t(control.steering ? "voice.steering" : "voice.steer");
  return (
    <div className="voice-call-actions">
      <VoiceSetupHint required={paused && !control.setupComplete}>
        <ActionButton
          className="icon ghost"
          disabled={busy || (paused && (control.blocked || !control.setupComplete))}
          aria-label={micLabel}
          title={paused && !control.setupComplete ? t("voice.setupRequired") : micLabel}
          aria-pressed={voice.muted}
          onClick={() => (paused ? control.start("conversation") : voice.mute(!voice.muted))}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            {paused ? (
              <path d="m9 5 10 7-10 7Z" />
            ) : (
              <>
                <rect x="9" y="3" width="6" height="12" rx="3" />
                <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" />
                {voice.muted && <path d="m3 3 18 18" />}
              </>
            )}
          </svg>
        </ActionButton>
      </VoiceSetupHint>
      <ActionButton
        className="icon ghost"
        disabled={busy || paused}
        aria-label={readingLabel}
        title={readingLabel}
        aria-pressed={voice.readingPaused}
        onClick={() => voice.pauseReading(!voice.readingPaused)}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path d="M11 4 5 9H2v6h3l6 5Z" />
          {voice.readingPaused ? <path d="m16 8 6 4-6 4Z" /> : <path d="M16 8v8m5-8v8" />}
        </svg>
      </ActionButton>
      <ActionButton
        className="icon ghost"
        disabled={busy || paused || control.blocked || control.editing}
        aria-label={steerLabel}
        title={steerLabel}
        aria-pressed={control.steering}
        onClick={() => control.setSteering(!control.steering)}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path d="M5 21V10a4 4 0 0 1 4-4h10m-5-5 5 5-5 5" />
        </svg>
      </ActionButton>
    </div>
  );
};
