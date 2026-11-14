import { useContext } from "react";
import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../../shared/protocol";
import { PlanPanelContext } from "../../lib/plan-panel-context";
import { MarkdownText } from "./MarkdownText";
import { PlanIcon } from "./PlanIcon";
import { PlanDocumentActions } from "./PlanDocumentActions";
import "./PlanResultCard.css";

export const PlanResultCard = ({
  plan,
}: {
  plan: NonNullable<SessionSnapshot["state"]["planning"]>["plans"][number];
}) => {
  const { t } = useTranslation();
  const open = useContext(PlanPanelContext);
  return (
    <section className="plan-result-card" aria-label={plan.title}>
      <header>
        <span className="plan-result-label">
          <PlanIcon />
          Plan
        </span>
        <span className="plan-result-version">v{plan.version}</span>
        <PlanDocumentActions plan={plan} />
        <button
          type="button"
          className="plan-result-expand"
          aria-label={t("openPlanPanel")}
          title={t("openPlanPanel")}
          onClick={() => open(plan.id)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />
          </svg>
        </button>
      </header>
      <div
        className="plan-result-preview"
        role="button"
        tabIndex={0}
        aria-label={t("openPlanPanel") + ": " + plan.title}
        onClick={() => open(plan.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            open(plan.id);
          }
        }}
      >
        <h3>{plan.title}</h3>
        <div inert>
          <MarkdownText text={plan.markdown.slice(0, 4000)} />
        </div>
      </div>
    </section>
  );
};
