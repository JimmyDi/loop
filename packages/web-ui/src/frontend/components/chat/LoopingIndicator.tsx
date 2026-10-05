import { useTranslation } from "react-i18next";

import "./LoopingIndicator.css";

export const LoopingIndicator = () => {
  const { t } = useTranslation();

  return (
    <div className="looping-indicator" role="status" aria-live="polite" aria-atomic="true">
      <span className="looping-indicator-text">{t("looping", "Looping...")}</span>
    </div>
  );
};
