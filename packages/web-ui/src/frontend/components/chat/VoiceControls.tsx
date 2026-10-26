import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";

import type { VoiceControlsProps } from "./voice-controls-types";
import { VoiceCallPanel } from "./VoiceCallPanel";
import { VoiceCallButton } from "./VoiceCallButton";
import { voiceErrorKey } from "../../voice/errors";
import { ActionButton } from "../ui/ActionButton";
import "./VoiceControls.css";

const SettingsDialog = lazy(() =>
  import("../settings/SettingsDialog").then((module) => ({ default: module.SettingsDialog })),
);

export const VoiceControls = ({ control, running, actions }: VoiceControlsProps) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState(false);
  const { voice } = control;
  return (
    <>
      {actions && createPortal(<VoiceCallButton control={control} />, actions)}
      {(!!voice.mode || !!control.notice || !!voice.error || settings) && (
        <div className="voice-controls" data-active={!!voice.mode}>
          {voice.mode && <VoiceCallPanel control={control} running={running} />}
          {control.notice && (
            <p role="status" className="voice-notice">
              {control.notice}
            </p>
          )}
          {!!voice.error && (
            <div className="voice-notice" role="alert">
              <p>{t(voiceErrorKey(voice.error))}</p>
              <ActionButton onClick={() => setSettings(true)}>
                {t("voice.installHint")}
              </ActionButton>
            </div>
          )}
          {settings && (
            <Suspense>
              <SettingsDialog initialSection="voice" onClose={() => setSettings(false)} />
            </Suspense>
          )}
        </div>
      )}
    </>
  );
};
