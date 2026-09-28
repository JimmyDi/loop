import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "../../lib/api";
import "./ErrorNotice.css";

export const ErrorNotice = ({
  error,
  dismissible = false,
}: {
  error?: unknown;
  dismissible?: boolean;
}) => {
  const { t } = useTranslation();
  const [dismissedError, setDismissedError] = useState<unknown>();

  useEffect(() => setDismissedError(undefined), [error]);

  if (!error || (dismissible && dismissedError === error)) return null;

  const message =
    error instanceof ApiError
      ? t("errors." + error.code, { defaultValue: error.message })
      : error instanceof Error
        ? error.message
        : String(error);

  return (
    <div className="error-notice" role="alert" data-dismissible={dismissible || undefined}>
      <strong>{t("failed")}</strong>
      <span>{message}</span>
      {/connection error|connection timed out|request timed out/i.test(message) && (
        <span>{t("modelConnectionHint")}</span>
      )}
      {dismissible && (
        <button
          type="button"
          className="error-notice-close"
          aria-label={t("close")}
          title={t("close")}
          onClick={() => setDismissedError(() => error)}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="m6 6 12 12M6 18 18 6" />
          </svg>
        </button>
      )}
    </div>
  );
};
