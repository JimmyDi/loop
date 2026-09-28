import { useTranslation } from "react-i18next";

import type { SessionSummary } from "../../../shared/protocol";
import { useWorkspace } from "../../state/workspace-store";
import { useSessions } from "../../state/session-store";
import "./SessionList.css";

export const SessionList = ({ sessions }: { sessions: SessionSummary[] }) => {
  const { t } = useTranslation();
  const active = useWorkspace((state) => state.active);
  const open = useWorkspace((state) => state.open);
  const views = useSessions((state) => state.views);

  return (
    <ul className="session-list">
      {!sessions.length && <li className="session-empty">{t("noSessions")}</li>}
      {sessions.map((session) => {
        const view = views[session.id];
        const generating =
          view?.connected && view.snapshot
            ? view.snapshot.operation === "prompt"
            : session.isGenerating === true;
        const title =
          (view?.connected ? view.snapshot?.state.title?.text : undefined) ??
          session.title ??
          t("newSession");

        return (
          <li key={session.id}>
            <button
              type="button"
              title={title}
              aria-current={active?.id === session.id ? "page" : undefined}
              onClick={() => open({ id: session.id, workspaceId: session.workspaceId })}
            >
              <span className="session-list-title">{title}</span>
              {generating && (
                <span
                  className="session-list-spinner"
                  role="img"
                  aria-label={t("looping", "Looping...")}
                  title={t("looping", "Looping...")}
                />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
};
