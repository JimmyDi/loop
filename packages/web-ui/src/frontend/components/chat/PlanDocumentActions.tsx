import { useTranslation } from "react-i18next";

import { useCopy } from "../../hooks/useCopy";
import "./PlanDocumentActions.css";

export const PlanDocumentActions = ({ plan }: { plan: { title: string; markdown: string } }) => {
  const { t } = useTranslation();
  const { copy, status } = useCopy();
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([plan.markdown], { type: "text/markdown;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "plan.md";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="plan-document-actions">
      <button
        type="button"
        aria-label={t("downloadPlan")}
        title={t("downloadPlan")}
        onClick={download}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5" />
        </svg>
      </button>
      <button
        type="button"
        aria-label={t(status)}
        title={t(status)}
        data-status={status}
        onClick={() => void copy(plan.markdown)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {status === "copied" ? (
            <path d="m5 12 4 4L19 6" />
          ) : status === "copyFailed" ? (
            <path d="m6 6 12 12M18 6 6 18" />
          ) : (
            <>
              <rect x="8" y="3" width="12" height="13" rx="2" />
              <path d="M16 16v5H4V8h4" />
            </>
          )}
        </svg>
      </button>
      {status !== "copy" && (
        <span className="plan-copy-feedback" data-status={status} role="status">
          {t(status)}
        </span>
      )}
    </div>
  );
};
