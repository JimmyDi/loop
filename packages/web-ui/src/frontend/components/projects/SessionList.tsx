import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { SessionSummary } from "../../../shared/protocol";
import type { PendingScheduleSession } from "../../hooks/useManualScheduleSessions";
import { ActionButton } from "../ui/ActionButton";
import { SessionItem } from "./SessionItem";
import "./SessionList.css";

export const SessionList = ({
  sessions,
  pinned = false,
  pending = [],
}: {
  sessions: SessionSummary[];
  pinned?: boolean;
  pending?: PendingScheduleSession[];
}) => {
  const { t } = useTranslation();
  const [visibleCount, setVisibleCount] = useState(5);
  const unpinned = sessions.filter((session) => pinned === Boolean(session.pinnedAt));

  const waiting = pending.filter(
    (item) => !sessions.some((session) => session.id === item.sessionId),
  );

  return (
    <ul className="session-list">
      {waiting.map((item) => {
        const busy = !item.status || item.status === "queued" || item.status === "running";
        return (
          <li key={item.requestId} className="session-item">
            <div className="session-item-open session-pending">
              <span className="session-list-title">{item.name}</span>
              {busy && (
                <span
                  className="session-list-spinner"
                  role="img"
                  aria-label={t(
                    item.status ? "scheduleStatus_" + item.status : "scheduleSubmitting",
                  )}
                />
              )}
            </div>
          </li>
        );
      })}
      {!waiting.length && !sessions.length && <li className="session-empty">{t("noSessions")}</li>}
      {unpinned.slice(0, visibleCount).map((session) => (
        <SessionItem key={session.id} session={session} />
      ))}
      {unpinned.length > visibleCount && (
        <li className="session-list-more">
          <ActionButton
            className="session-show-more ghost"
            onClick={() => setVisibleCount((count) => Math.min(count + 10, unpinned.length))}
          >
            {t("showMoreSessions")}
          </ActionButton>
        </li>
      )}
    </ul>
  );
};
