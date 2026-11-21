import { useTranslation } from "react-i18next";

import { useSettings } from "../../state/settings-store";
import type { VoiceControlsProps } from "./voice-controls-types";
import { voiceErrorKey } from "../../voice/errors";
import { ActionButton } from "../ui/ActionButton";
import "./VoiceControls.css";

export const VoiceControls = ({ control }: VoiceControlsProps) => {
  const { t } = useTranslation();
  const openSettings = useSettings((state) => state.open);
  const { voice } = control;
  return (
    <>
      {!!voice.error && (
        <div className="voice-controls" data-active={!!voice.mode}>
          {!!voice.error && (
            <div className="voice-notice" role="alert">
              <p>{t(voiceErrorKey(voice.error))}</p>
              <ActionButton onClick={() => openSettings("voice")}>
                {t("voice.installHint")}
              </ActionButton>
            </div>
          )}
        </div>
      )}
    </>
  );
};
