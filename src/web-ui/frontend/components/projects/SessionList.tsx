import { useTranslation } from "react-i18next";

import type { SessionSummary } from "../../../shared/protocol";
import { useWorkspace } from "../../state/workspace-store";
import "./SessionList.css";

export const SessionList = ({ sessions }: { sessions: SessionSummary[] }) => {
  const { t, i18n } = useTranslation();
  const active = useWorkspace((state) => state.active);
  const open = useWorkspace((state) => state.open);

  return (
    <ul className="session-list">
      {!sessions.length && <li className="session-empty">{t("noSessions")}</li>}
      {sessions.map((session) => {
        const title = new Date(session.createdAt).toLocaleString(i18n.language);

        return (
          <li key={session.id}>
            <button
              type="button"
              aria-current={active === session.id ? "page" : undefined}
              onClick={() => open({ id: session.id, workspaceId: session.workspaceId, title })}
            >
              {title}
            </button>
          </li>
        );
      })}
    </ul>
  );
};
