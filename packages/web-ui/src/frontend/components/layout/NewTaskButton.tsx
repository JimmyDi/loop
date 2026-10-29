import { useTranslation } from "react-i18next";

import type { Project, SessionSnapshot } from "../../../shared/protocol";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { command } from "../../lib/api";
import { useWorkspace } from "../../state/workspace-store";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import "./NewTaskButton.css";

export const NewTaskButton = ({ projects }: { projects: Project[] }) => {
  const { t } = useTranslation();
  const workspaceId = useWorkspace((state) => state.active?.workspaceId);
  const action = useAsyncAction();
  const project = projects.find(
    (project) => project.id === workspaceId && project.accessible !== false,
  );

  const create = () =>
    action.run(async () => {
      const snapshot = await command<SessionSnapshot>("/sessions", {
        workspaceId: project?.id ?? null,
      });
      useWorkspace.getState().open({ id: snapshot.sessionId, workspaceId: project?.id ?? null });
    });

  return (
    <div className="sidebar-new-task">
      <ActionButton className="ghost" disabled={action.pending} onClick={() => void create()}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 4H6a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h11a3 3 0 0 0 3-3v-6M16 3a2.1 2.1 0 0 1 3 3l-8 8-4 1 1-4 8-8Z" />
        </svg>
        <span>{t("newTask")}</span>
      </ActionButton>
      <ErrorNotice error={action.error} />
    </div>
  );
};
