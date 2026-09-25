import { useTranslation } from "react-i18next";

import type { Project } from "../../../shared/protocol";
import { useProjectSessions } from "../../hooks/useProjectSessions";
import { useWorkspace } from "../../state/workspace-store";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { ProjectActions } from "./ProjectActions";
import { SessionList } from "./SessionList";
import "./ProjectItem.css";

export const ProjectItem = ({ project }: { project: Project }) => {
  const { t } = useTranslation();
  const expanded = useWorkspace((state) => state.expanded[project.id] ?? true);
  const setExpanded = (value: boolean) => useWorkspace.getState().expand(project.id, value);
  const { sessions, create } = useProjectSessions(
    project.id,
    expanded && project.accessible !== false,
  );
  const open = useWorkspace((state) => state.open);
  const createSession = async () => {
    try {
      const snapshot = await create.mutateAsync();

      open({ id: snapshot.sessionId, workspaceId: project.id, title: t("newSession") });
    } catch {
      /* Mutation exposes the error below. */
    }
  };

  return (
    <section className="project-item">
      <div className="project-heading">
        <button
          type="button"
          aria-expanded={expanded}
          title={project.cwd}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "▾" : "▸"} {project.name}
        </button>
        <ActionButton
          className="ghost"
          aria-label={t("newSession")}
          disabled={create.isPending || project.accessible === false}
          onClick={() => void createSession()}
        >
          ＋
        </ActionButton>
      </div>
      {expanded && (
        <>
          <ProjectActions project={project} />
          {project.accessible === false ? (
            <p>{t("unavailable")}</p>
          ) : (
            <SessionList sessions={sessions.data ?? []} />
          )}
          <ErrorNotice error={sessions.error ?? create.error} />
        </>
      )}
    </section>
  );
};
