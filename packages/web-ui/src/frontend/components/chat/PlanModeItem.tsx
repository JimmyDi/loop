import { PlanIcon } from "./PlanIcon";
import { useTranslation } from "react-i18next";

import "./PlanModeItem.css";

export const PlanModeItem = ({
  active,
  disabled,
  change,
}: {
  active: boolean;
  disabled: boolean;
  change(active: boolean): void;
}) => {
  const { t } = useTranslation();
  if (!active) return null;
  return (
    <button
      type="button"
      className="composer-plan-item"
      disabled={disabled}
      aria-label={t("cancelPlanMode")}
      title={t("planModeDescription")}
      onClick={() => change(false)}
    >
      <span className="composer-plan-icon" aria-hidden="true">
        <PlanIcon />
        <span className="composer-plan-close">×</span>
      </span>
      <span>Plan</span>
    </button>
  );
};
