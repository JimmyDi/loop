import { useTranslation } from "react-i18next";

import { useElapsedTime } from "../../hooks/useElapsedTime";
import "./CompactionStatus.css";

export const CompactionStatus = ({
  running = false,
  connected = true,
  startedAt,
}: {
  running?: boolean;
  connected?: boolean;
  startedAt?: number;
}) => {
  const { t } = useTranslation();
  const { seconds, duration } = useElapsedTime(running && connected ? startedAt : undefined);

  return (
    <div className="compaction-status" data-running={running}>
      {running && connected && startedAt !== undefined && (
        <div className="compaction-duration">{t("workingFor", { duration })}</div>
      )}
      <div className="compaction-status-row" role="status" aria-live="polite" aria-atomic="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 4v13a3 3 0 0 0 3 3h3M13 4h3a3 3 0 0 1 3 3v13M9 8h6M9 12h4M9 16h6" />
          <circle cx="5" cy="4" r="1" />
          <circle cx="19" cy="20" r="1" />
        </svg>
        <span>
          {t(running ? "compaction.running" : "compaction.completed")}
          {running && connected && seconds >= 15 && (
            <span className="compaction-wait-hint"> · {t("compaction.waitHint")}</span>
          )}
        </span>
      </div>
    </div>
  );
};
