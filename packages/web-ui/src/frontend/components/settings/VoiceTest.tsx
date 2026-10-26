import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useVoice } from "../../hooks/useVoice";
import { ActionButton } from "../ui/ActionButton";
import { voiceErrorKey } from "../../voice/errors";
import type { VoiceTestProps } from "./voice-test-types";
import "./VoiceTest.css";

export const VoiceTest = ({ disabled, speechDisabled = false, onStateChange }: VoiceTestProps) => {
  const { t } = useTranslation();
  const verified = useRef(false);
  const voice = useVoice({
    transcript: (text, final) => {
      if (final && text.trim()) {
        verified.current = true;
        onStateChange?.("verified");
      }
    },
  });
  const preview = useRef(false);
  useEffect(() => {
    if (voice.error || voice.status === "paused") {
      preview.current = false;
      verified.current = false;
      onStateChange?.("failed");
    } else if (voice.mode && !verified.current) onStateChange?.("loading");
  }, [voice.error, voice.mode, voice.status === "paused", onStateChange]);
  useEffect(() => {
    if (disabled && voice.mode) void voice.stop();
  }, [disabled, voice.mode, voice.stop]);
  useEffect(() => {
    if (voice.status !== "listening" || !preview.current) return;
    preview.current = false;
    voice.speak(t("voice.sample"));
  }, [voice.status, voice.speak, t]);
  return (
    <div className="voice-test">
      <div className="voice-test-actions">
        <ActionButton
          disabled={disabled}
          onClick={() => {
            preview.current = false;
            if (voice.mode) {
              onStateChange?.(verified.current ? "verified" : "idle");
              void voice.stop();
            } else {
              verified.current = false;
              onStateChange?.("loading");
              void voice.start("test");
            }
          }}
        >
          {t(voice.mode ? "voice.stopTest" : "voice.microphone")}
        </ActionButton>
        <ActionButton
          disabled={disabled || speechDisabled}
          onClick={() => {
            if (voice.mode && voice.status === "listening") voice.speak(t("voice.sample"));
            else {
              preview.current = true;
              verified.current = false;
              onStateChange?.("loading");
              void voice.start("test");
            }
          }}
        >
          {t("voice.preview")}
        </ActionButton>
      </div>
      {voice.mode && <p role="status">{t("voice." + voice.status)}</p>}
      {voice.text && <p aria-label={t("voice.final")}>{voice.text}</p>}
      {!!voice.error && <p role="alert">{t(voiceErrorKey(voice.error))}</p>}
    </div>
  );
};
