import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { SessionSummary } from "../../../shared/protocol";
import { ActionButton } from "../ui/ActionButton";
import { SessionItem } from "./SessionItem";
import "./SessionList.css";

export const SessionList = ({ sessions }: { sessions: SessionSummary[] }) => {
  const { t } = useTranslation();
  const [visibleCount, setVisibleCount] = useState(5);

  return (
    <ul className="session-list">
      {!sessions.length && <li className="session-empty">{t("noSessions")}</li>}
      {sessions.slice(0, visibleCount).map((session) => (
        <SessionItem key={session.id} session={session} />
      ))}
      {sessions.length > visibleCount && (
        <li className="session-list-more">
          <ActionButton
            className="session-show-more ghost"
            onClick={() => setVisibleCount((count) => Math.min(count + 10, sessions.length))}
          >
            {t("showMoreSessions")}
          </ActionButton>
        </li>
      )}
    </ul>
  );
};
