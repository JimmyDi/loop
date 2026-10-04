import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useProjects } from "../../hooks/useProjects";
import { useWorkspace } from "../../state/workspace-store";
import { AddProjectDialog } from "../projects/AddProjectDialog";
import { ProjectItem } from "../projects/ProjectItem";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { LoopIcon } from "../ui/LoopIcon";
import { SettingsIcon } from "../ui/SettingsIcon";
import { SettingsDialog } from "../settings/SettingsDialog";
import "./Sidebar.css";

export const Sidebar = () => {
  const { t } = useTranslation();
  const { projects } = useProjects();
  const projectsId = useId();
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [adding, setAdding] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addedProjectId, setAddedProjectId] = useState<string>();
  const projectList = useRef<HTMLDivElement>(null);
  const toggle = useWorkspace((state) => state.toggleSidebar);

  useEffect(() => {
    if (adding || !projectsExpanded || !addedProjectId) return;

    const item = Array.from(projectList.current?.children ?? []).find(
      (item) => item.getAttribute("data-project-id") === addedProjectId,
    );
    if (!item) return;

    item.querySelector<HTMLButtonElement>(".project-toggle")?.focus({ preventScroll: true });
    item.scrollIntoView({ block: "nearest" });
    setAddedProjectId(undefined);
  }, [adding, projectsExpanded, addedProjectId, projects.data]);

  return (
    <aside className="sidebar" aria-label={t("projects")}>
      <div className="sidebar-brand">
        <LoopIcon />
        <strong>Loop</strong>
        <ActionButton
          className="sidebar-close ghost"
          aria-label={t("closeSidebar")}
          onClick={() => toggle(false)}
        >
          ×
        </ActionButton>
      </div>
      <div className="sidebar-heading">
        <button
          type="button"
          className="sidebar-projects-toggle"
          aria-expanded={projectsExpanded}
          aria-controls={projectsId}
          onClick={() => setProjectsExpanded((expanded) => !expanded)}
        >
          <span>{t("projects")}</span>
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d={projectsExpanded ? "m4 6 4 4 4-4" : "m6 4 4 4-4 4"} />
          </svg>
        </button>
        <ActionButton
          className="icon ghost"
          aria-label={t("addProject")}
          onClick={() => setAdding(true)}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 4v16M4 12h16" />
          </svg>
        </ActionButton>
      </div>
      <div className="sidebar-projects" id={projectsId} ref={projectList}>
        {projectsExpanded && (
          <>
            {projects.isPending && <p>{t("loading")}</p>}
            <ErrorNotice error={projects.error} />
            {projects.data?.map((project) => (
              <ProjectItem key={project.id} project={project} />
            ))}
            {projects.data?.length === 0 && (
              <ActionButton className="sidebar-empty" onClick={() => setAdding(true)}>
                {t("noProjects")}
              </ActionButton>
            )}
          </>
        )}
      </div>
      <footer>
        <ActionButton
          className="sidebar-settings ghost"
          aria-haspopup="dialog"
          onClick={() => setSettingsOpen(true)}
        >
          <SettingsIcon />
          {t("settings")}
        </ActionButton>
      </footer>
      {adding && (
        <AddProjectDialog
          onAdded={(project) => {
            useWorkspace.getState().expand(project.id, true);
            setProjectsExpanded(true);
            setAddedProjectId(project.id);
          }}
          onClose={() => setAdding(false)}
        />
      )}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </aside>
  );
};
