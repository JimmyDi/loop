import { useTranslation } from "react-i18next";

import { useCopy } from "../../hooks/useCopy";
import { ActionButton } from "./ActionButton";
import "./CopyButton.css";

export const CopyButton = ({ text, label }: { text: string; label?: string }) => {
  const { t } = useTranslation();
  const { status, copy } = useCopy();
  const description = status === "copy" ? (label ?? t("copy")) : t(status);

  return (
    <ActionButton
      className="copy-button ghost"
      onClick={() => void copy(text)}
      aria-label={description}
      title={description}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {status === "copied" ? (
          <path d="m5 12 4 4L19 6" />
        ) : status === "copyFailed" ? (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v6m0 4h.01" />
          </>
        ) : (
          <>
            <rect x="8" y="8" width="12" height="12" rx="2" />
            <path d="M16 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
          </>
        )}
      </svg>
      <span className="copy-button-status" role="status">
        {status !== "copy" ? t(status) : ""}
      </span>
    </ActionButton>
  );
};
