import { useId } from "react";
import { useTranslation } from "react-i18next";

import { LanguageSelect } from "./LanguageSelect";
import { AppearanceSettings } from "./AppearanceSettings";
import "./GeneralSettings.css";

export const GeneralSettings = () => {
  const { t } = useTranslation();
  const labelId = useId();

  return (
    <>
      <div className="general-settings-row">
        <span id={labelId}>{t("language")}</span>
        <LanguageSelect labelId={labelId} />
      </div>
      <AppearanceSettings />
    </>
  );
};
