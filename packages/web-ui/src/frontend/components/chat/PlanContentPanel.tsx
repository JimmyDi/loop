import { useTranslation } from "react-i18next";

import { MarkdownText } from "./MarkdownText";
import { PlanDocumentActions } from "./PlanDocumentActions";
import "./PlanContentPanel.css";

export const PlanContentPanel = ({
  plan,
}: {
  plan: { id: string; title: string; markdown: string; version: number };
}) => {
  const { t } = useTranslation();
  return (
    <section className="plan-content-panel" aria-label={t("planContent")}>
      <header>
        <PlanDocumentActions plan={plan} />
      </header>
      <div className="plan-content-scroll" key={plan.id} tabIndex={0}>
        <h2>{plan.title}</h2>
        <MarkdownText text={plan.markdown} />
      </div>
    </section>
  );
};
