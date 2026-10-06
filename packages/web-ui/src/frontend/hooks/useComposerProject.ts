import { useQueryClient } from "@tanstack/react-query";

import type { Project, SessionSnapshot } from "../../shared/protocol";
import { createProjectDraft } from "../lib/create-project-draft";
import { useWorkspace } from "../state/workspace-store";
import { useAsyncAction } from "./useAsyncAction";
import { useProjects } from "./useProjects";

export const useComposerProject = (snapshot: SessionSnapshot, enabled: boolean) => {
  const client = useQueryClient();
  const { projects } = useProjects(enabled);
  const action = useAsyncAction();
  const cleared = useWorkspace((state) => state.unselectedProjects[snapshot.sessionId]);
  const project = cleared
    ? undefined
    : projects.data?.find((item) => item.id === snapshot.workspaceId);
  const hasProject = !enabled || Boolean(project && project.accessible !== false);

  const select = async (project: Project): Promise<boolean> => {
    if (project.accessible === false || action.pending) return false;
    if (project.id === snapshot.workspaceId) {
      action.clearError();
      useWorkspace.getState().selectDraftProject(snapshot.sessionId);
      return true;
    }
    let selected = false;
    await action.run(async () => {
      const next = await createProjectDraft(project.id, snapshot);
      client.setQueryData(["session", next.sessionId], next);
      if (useWorkspace.getState().active?.id !== snapshot.sessionId) return;
      const target = { id: next.sessionId, workspaceId: project.id };
      useWorkspace.getState().moveDraft(snapshot.sessionId, target);
      useWorkspace.getState().open(target);
      selected = true;
    });
    return selected;
  };

  return {
    project,
    projects,
    hasProject,
    select,
    clear: () => {
      action.clearError();
      useWorkspace.getState().clearDraftProject(snapshot.sessionId);
    },
    pending: action.pending,
    error: action.error,
  };
};
