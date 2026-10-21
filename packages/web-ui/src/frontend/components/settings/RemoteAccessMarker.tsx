import { useTranslation } from "react-i18next";

import "./RemoteAccessMarker.css";

export const RemoteAccessMarker = ({
  complete,
  loading,
  failed,
}: {
  complete: boolean;
  loading: boolean;
  failed: boolean;
}) => {
  const { t } = useTranslation();
  const state = loading ? "loading" : failed ? "failed" : complete ? "completed" : "incomplete";
  return (
    <span
      className="remote-access-marker"
      data-loading={loading}
      data-state={state}
      role="img"
      aria-label={t("remote." + state)}
    >
      {(state === "completed" || state === "failed") && (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d={state === "failed" ? "m6 6 8 8m0-8-8 8" : "m5 10 3.2 3.2L15 6.5"}
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      )}
    </span>
  );
};
