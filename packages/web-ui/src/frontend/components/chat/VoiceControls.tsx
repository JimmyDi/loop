import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";

import type { VoiceControlsProps } from "./voice-controls-types";
import { voiceErrorKey } from "../../voice/errors";
import { ActionButton } from "../ui/ActionButton";
import "./VoiceControls.css";

const SettingsDialog = lazy(() =>
  import("../settings/SettingsDialog").then((module) => ({ default: module.SettingsDialog })),
);

export const VoiceControls = ({ control }: VoiceControlsProps) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState(false);
  const { voice } = control;
  return (
    <>
      {(!!voice.error || settings) && (
        <div className="voice-controls" data-active={!!voice.mode}>
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
