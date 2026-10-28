import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useVoice } from "../../hooks/useVoice";
import { ActionButton } from "../ui/ActionButton";
import { voiceErrorKey } from "../../voice/errors";
import type { VoiceTestProps } from "./voice-test-types";
import { VoiceInputTest } from "./VoiceInputTest";
import "./VoiceTest.css";

export const VoiceTest = ({ disabled, speechDisabled = false, onStateChange }: VoiceTestProps) => {
  const { t } = useTranslation();
  const [inputBusy, setInputBusy] = useState(false);
  const [progress, setProgress] = useState<number>();
  const [sample, setSample] = useState("");
  const voice = useVoice({
    synthesis: true,
    playbackProgress: setProgress,
    transcript: () => {},
  });
  const preview = useRef(false);
  const playing = useRef(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  useEffect(() => {
    if (previewBusy && (voice.error || voice.status === "paused")) {
      preview.current = false;
      playing.current = false;
      setPreviewBusy(false);
      void voice.stop();
    }
  }, [previewBusy, voice.error, voice.status, voice.stop]);
  useEffect(() => {
    if (disabled && voice.mode) void voice.stop();
  }, [disabled, voice.mode, voice.stop]);
  useEffect(() => {
    if (!previewBusy) return;
    if (voice.status === "speaking") playing.current = true;
    if (voice.status !== "listening") return;
    if (preview.current) {
      preview.current = false;
      voice.mute(true);
      setSample(t("voice.sample"));
      voice.speak(t("voice.sample"));
    } else if (playing.current) {
      playing.current = false;
      setPreviewBusy(false);
      void voice.stop();
    }
  }, [previewBusy, voice.status, voice.speak, voice.stop, voice.mute, t]);
  return (
    <div className="voice-test">
      <div className="voice-test-actions">
        <VoiceInputTest
          disabled={disabled || previewBusy}
          onStart={() => {
            preview.current = false;
            playing.current = false;
            setPreviewBusy(false);
            void voice.stop();
          }}
          onStateChange={(state) => {
            setInputBusy(state === "loading");
            onStateChange?.(state);
          }}
        />
        <div className="voice-test-row voice-preview-row">
          <span className="voice-test-label">{t("voice.preview")}</span>
          <div className="voice-preview-controls">
            <ActionButton
              className="icon ghost voice-preview-button"
              data-busy={previewBusy && progress === undefined}
              aria-label={t("voice.preview")}
              title={t("voice.preview")}
              disabled={disabled || speechDisabled || inputBusy || previewBusy}
              onClick={() => {
                setProgress(undefined);
                setSample("");
                preview.current = true;
                playing.current = false;
                setPreviewBusy(true);
                void voice.start("test");
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m11 4-6 5H2v6h3l6 5V4ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
              </svg>
            </ActionButton>
            {sample && (
              <span
                className="voice-preview-text"
                data-playing={previewBusy && progress !== undefined}
                style={{ "--voice-read-progress": (progress ?? 0) * 100 + "%" } as CSSProperties}
              >
                {sample}
              </span>
            )}
          </div>
        </div>
      </div>
      {!!voice.error && <p role="alert">{t(voiceErrorKey(voice.error))}</p>}
    </div>
  );
};
