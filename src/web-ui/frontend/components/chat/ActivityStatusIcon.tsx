import { useTranslation } from "react-i18next";

import type { ActivityStatus } from "./activity-status";
import "./ActivityStatusIcon.css";

export const ActivityStatusIcon = ({
  status,
  labelStatus = status,
}: {
  status: ActivityStatus | "waiting";
  labelStatus?: ActivityStatus | "waiting";
}) => {
  const { t } = useTranslation();

  return (
    <svg
      className="activity-status-icon"
      data-status={status}
      viewBox="0 0 24 24"
      role="img"
      aria-label={t(labelStatus)}
    >
      {status === "running" ? <path d="M12 3a9 9 0 1 1-9 9" /> : <circle cx="12" cy="12" r="9" />}
      {status === "success" && <path d="m8 12 3 3 5-6" />}
      {status === "error" && <path d="m9 9 6 6m0-6-6 6" />}
      {status === "cancelled" && <path d="M8 12h8" />}
    </svg>
  );
};
