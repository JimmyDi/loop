import { useTranslation } from "react-i18next";

import type { Project } from "../../../shared/protocol";
import { useProjects } from "../../hooks/useProjects";
import { useWorkspace } from "../../state/workspace-store";
import { useRequests } from "../../state/request-store";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import "./ProjectActions.css";

export const ProjectActions = ({ project }: { project: Project }) => {
  const { t } = useTranslation();
  const { rename, remove } = useProjects();
  const renameProject = () => {
    const name = window.prompt(t("projectName"), project.name);

    if (name?.trim()) rename.mutate({ id: project.id, name });
  };
  const removeProject = async () => {
    const state = useWorkspace.getState();
    const drafts = Object.keys(state.drafts).some(
      (id) => state.draftProjects[id] === project.id && state.drafts[id]?.trim(),
    );

    if (!window.confirm(t(drafts ? "draftConfirm" : "removeConfirm"))) return;

    try {
      await remove.mutateAsync(project.id);

      for (const tab of state.tabs) {
        if (tab.workspaceId === project.id) useRequests.getState().put(tab.id);
      }

      for (const [id, workspaceId] of Object.entries(state.draftProjects)) {
        if (workspaceId === project.id) useRequests.getState().put(id);
      }

      state.removeProject(project.id);
    } catch {
      /* Mutation exposes the error below. */
    }
  };

  return (
    <div className="project-actions">
      <ActionButton
        className="ghost"
        disabled={rename.isPending || remove.isPending}
        onClick={renameProject}
      >
        {t("rename")}
      </ActionButton>
      <ActionButton
        className="ghost"
        disabled={rename.isPending || remove.isPending}
        onClick={() => void removeProject()}
      >
        {t("remove")}
      </ActionButton>
      <ErrorNotice error={rename.error ?? remove.error} />
    </div>
  );
};
