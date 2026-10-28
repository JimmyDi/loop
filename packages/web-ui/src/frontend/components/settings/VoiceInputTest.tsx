import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useVoiceInputSession } from "../../hooks/useVoiceInputSession";
import { useVoice } from "../../hooks/useVoice";
import { voiceErrorKey } from "../../voice/errors";
import { ActionButton } from "../ui/ActionButton";
import type { VoiceInputTestProps } from "./voice-input-test-types";
import { VoiceInputRecording } from "../voice/VoiceInputRecording";
import "./VoiceInputTest.css";

export const VoiceInputTest = ({ disabled, onStateChange, onStart }: VoiceInputTestProps) => {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [completed, setCompleted] = useState(false);
  const [recordingKey, setRecordingKey] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const restarting = useRef(false);
  const input = useVoiceInputSession({
    finalOnly: true,
    complete: (result) => {
      setText(result);
      setCompleted(true);
      onStateChange?.(result ? "verified" : "idle");
    },
  });
  const voice = useVoice({
    keepInputOpen: true,
    transcript: input.transcript,
    energy: input.energy,
  });
  const cancel = () => {
    restarting.current = false;
    input.discard(voice);
    setText("");
    setCompleted(false);
    onStateChange?.("idle");
  };
  useEffect(() => {
    if (disabled && (input.active || voice.mode)) cancel();
  }, [disabled]);
  useEffect(() => {
    if (!input.active || (!voice.error && voice.status !== "paused")) return;
    input.discard(voice);
    onStateChange?.("failed");
  }, [voice.error, voice.status]);
  const busy = input.active || retrying;
  const retry = async () => {
    if (restarting.current || disabled) return;
    restarting.current = true;
    setRetrying(true);
    setText("");
    setCompleted(false);
    onStateChange?.("loading");
    try {
      if (input.active) await voice.endInput();
      if (!restarting.current) return;
      input.begin();
      setRecordingKey((value) => value + 1);
      voice.mute(false);
    } catch {
      input.discard(voice);
      onStateChange?.("failed");
    } finally {
      restarting.current = false;
      setRetrying(false);
    }
  };
  const listening =
    busy && !retrying && !input.finishing && ["listening", "transcribing"].includes(voice.status);
  return (
    <div className="voice-input-test">
      <div className="voice-test-row voice-input-test-row">
        <span className="voice-test-label">{t("voice.dictation")}</span>
        <div className="voice-input-test-controls">
          <ActionButton
            className="icon ghost voice-input-test-microphone"
            disabled={disabled || busy}
            aria-label={t("voice.microphone")}
            title={t("voice.microphone")}
            data-busy={busy && (!listening || input.speaking)}
            onClick={() => {
              if (voice.mode === "test" && !voice.error && voice.status !== "paused") {
                void retry();
                return;
              }
              onStart?.();
              input.begin();
              setText("");
              setCompleted(false);
              onStateChange?.("loading");
              void voice.start("test");
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <rect x="9" y="3" width="6" height="12" rx="3" />
              <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" />
            </svg>
          </ActionButton>
          {completed ? (
            <>
              <p className="voice-input-test-result" aria-label={t("voice.final")}>
                {text}
              </p>
              <ActionButton
                className="icon ghost"
                aria-label={t("voice.retry")}
                title={t("voice.retry")}
                disabled={disabled}
                onClick={() => void retry()}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path d="M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6" />
                </svg>
              </ActionButton>
              <span className="voice-input-sampler-countdown" />
            </>
          ) : busy && (listening || input.finishing) ? (
            <VoiceInputRecording
              key={recordingKey}
              input={input}
              voice={voice}
              durationSeconds={30}
              disabled={disabled}
              onDiscard={cancel}
            />
          ) : null}
        </div>
      </div>
      {!!voice.error && <p role="alert">{t(voiceErrorKey(voice.error))}</p>}
    </div>
  );
};
