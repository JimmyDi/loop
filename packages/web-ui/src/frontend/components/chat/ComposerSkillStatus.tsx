import { useTranslation } from "react-i18next";

import "./ComposerSkillStatus.css";

export type ComposerSkillState = "loading" | "empty" | "unavailable" | "noMatch";

export const ComposerSkillStatus = ({ state }: { state: ComposerSkillState }) => {
  const { t } = useTranslation();
  return (
    <div className="composer-skill-status" role="status">
      {state === "loading" && (
        <span className="composer-skill-status-icon" aria-hidden="true">
          <span className="composer-skill-status-spinner" />
        </span>
      )}
      <div>
        <h4>{t("skills.picker." + state + "Title")}</h4>
        <p>{t("skills.picker." + state + "Hint")}</p>
      </div>
    </div>
  );
};
