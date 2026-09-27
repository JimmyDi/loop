import { useId } from "react";
import { useTranslation } from "react-i18next";

import { LanguageSelect } from "./LanguageSelect";
import "./GeneralSettings.css";

export const GeneralSettings = () => {
  const { t } = useTranslation();
  const labelId = useId();
  const sectionId = useId();
  const descriptionId = useId();

  return (
    <>
      <h3 className="general-settings-title">{t("general")}</h3>
      <section className="general-settings-section" aria-labelledby={sectionId}>
        <h4 id={sectionId}>{t("general")}</h4>
        <div className="general-settings-row">
          <div className="general-settings-description">
            <span id={labelId}>{t("language")}</span>
            <small id={descriptionId}>{t("languageDescription")}</small>
          </div>
          <LanguageSelect labelId={labelId} descriptionId={descriptionId} />
        </div>
      </section>
    </>
  );
};
