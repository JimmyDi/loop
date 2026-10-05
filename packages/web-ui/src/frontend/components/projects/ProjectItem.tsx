import { useState } from "react";
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
  const [contextPoint, setContextPoint] = useState<{ x: number; y: number }>();
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

      setExpanded(true);
      open({ id: snapshot.sessionId, workspaceId: project.id });
    } catch {
      /* Mutation exposes the error below. */
    }
  };

  return (
    <section className="project-item" data-project-id={project.id}>
      <div
        className="project-heading"
        onContextMenu={(event) => {
          event.preventDefault();
          setContextPoint({ x: event.clientX, y: event.clientY });
        }}
      >
        <button
          type="button"
          className="project-toggle"
          aria-expanded={expanded}
          title={project.cwd}
          onClick={() => setExpanded(!expanded)}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {expanded ? (
              <path d="M3 19V5a2 2 0 0 1 2-2h4l3 3h7a2 2 0 0 1 2 2v2M3 20h15l4-10H7L3 20Z" />
            ) : (
              <path d="M3 9h18M3 19V5a2 2 0 0 1 2-2h4l3 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
            )}
          </svg>
          <span>{project.name}</span>
        </button>
        <ProjectActions project={project} contextPoint={contextPoint} />
        <ActionButton
          className="project-icon-button icon ghost"
          aria-label={t("newSession")}
          title={t("newSession")}
          disabled={create.isPending || project.accessible === false}
          onClick={() => void createSession()}
        >
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
        </ActionButton>
      </div>
      {expanded && (
        <>
          {project.accessible === false ? (
            <p>{t("unavailable")}</p>
          ) : (
            <SessionList sessions={sessions.data ?? []} />
          )}
          <ErrorNotice error={sessions.error} />
        </>
      )}
      <ErrorNotice error={create.error} />
    </section>
  );
};
