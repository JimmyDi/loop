import { useTranslation } from "react-i18next";

import type { VoiceSetupHintProps } from "./voice-setup-hint-types";
import "./VoiceSetupHint.css";

export const VoiceSetupHint = ({ required, children }: VoiceSetupHintProps) => {
  const { t } = useTranslation();
  if (!required) return children;
  return (
    <span className="voice-setup-hint" title={t("voice.setupRequired")}>
      {children}
    </span>
  );
};
