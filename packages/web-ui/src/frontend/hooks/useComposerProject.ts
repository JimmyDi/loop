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
  const project = projects.data?.find((item) => item.id === snapshot.workspaceId);
  const hasProject =
    snapshot.workspaceId === null || !enabled || Boolean(project && project.accessible !== false);

  const select = async (project: Project | null): Promise<boolean> => {
    if (!enabled || project?.accessible === false || action.pending) return false;
    if ((project?.id ?? null) === snapshot.workspaceId) {
      action.clearError();
      return true;
    }
    let selected = false;
    await action.run(async () => {
      const next = await createProjectDraft(project?.id ?? null, snapshot);
      client.setQueryData(["session", next.sessionId], next);
      if (useWorkspace.getState().active?.id !== snapshot.sessionId) return;
      const target = { id: next.sessionId, workspaceId: project?.id ?? null };
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
    clear: () => void select(null),
    pending: action.pending,
    error: action.error,
  };
};
