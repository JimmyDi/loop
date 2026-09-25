import { useTranslation } from "react-i18next";

import { ApiError } from "../../lib/api";
import "./ErrorNotice.css";

export const ErrorNotice = ({ error }: { error?: unknown }) => {
  const { t } = useTranslation();

  if (!error) return null;

  const message =
    error instanceof ApiError
      ? t("errors." + error.code, { defaultValue: error.message })
      : error instanceof Error
        ? error.message
        : String(error);

  return (
    <div className="error-notice" role="alert">
      <strong>{t("failed")}</strong>
      <span>{message}</span>
      {/connection error|connection timed out|request timed out/i.test(message) && (
        <span>{t("modelConnectionHint")}</span>
      )}
    </div>
  );
};
