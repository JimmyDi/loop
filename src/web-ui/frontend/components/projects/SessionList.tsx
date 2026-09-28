import { useTranslation } from "react-i18next";

import type { SessionSummary } from "../../../shared/protocol";
import { SessionItem } from "./SessionItem";
import "./SessionList.css";

export const SessionList = ({ sessions }: { sessions: SessionSummary[] }) => {
  const { t } = useTranslation();
  return (
    <ul className="session-list">
      {!sessions.length && <li className="session-empty">{t("noSessions")}</li>}
      {sessions.map((session) => (
        <SessionItem key={session.id} session={session} />
      ))}
    </ul>
  );
};
