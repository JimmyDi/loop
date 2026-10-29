import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { flushSync } from "react-dom";

import { isRemoteClient } from "../../lib/remote-session";
import { useProjectSessions } from "../../hooks/useProjectSessions";
import { SidebarSessionSection } from "../projects/SidebarSessionSection";
import { useProjects } from "../../hooks/useProjects";
import { useSidebarClipping } from "../../hooks/useSidebarClipping";
import { scrollSidebarSection } from "../../lib/scroll-sidebar-section";
import { useWorkspace } from "../../state/workspace-store";
import { AddProjectDialog } from "../projects/AddProjectDialog";
import { ProjectItem } from "../projects/ProjectItem";
import { PinnedSessions } from "../projects/PinnedSessions";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { LoopIcon } from "../ui/LoopIcon";
import { SidebarMenu } from "./SidebarMenu";
import { NewTaskButton } from "./NewTaskButton";
import "./Sidebar.css";

const SettingsDialog = lazy(() =>
  import("../settings/SettingsDialog").then((module) => ({ default: module.SettingsDialog })),
);

export const Sidebar = () => {
  const { t } = useTranslation();
  const { projects } = useProjects();
  const chats = useProjectSessions(null, true).sessions;
  const [visibleProjects, setVisibleProjects] = useState(5);
  const projectsId = useId();
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [adding, setAdding] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addedProjectId, setAddedProjectId] = useState<string>();
  const projectList = useRef<HTMLDivElement>(null);
  const scroll = useSidebarClipping();
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
      <NewTaskButton projects={projects.data ?? []} />
      <div className="sidebar-scroll" ref={scroll}>
        <PinnedSessions projects={projects.data ?? []} />
        <SidebarSessionSection
          title={t("chats")}
          kind="chats"
          sessions={(chats.data ?? []).filter(
            (session) => session.workspaceId === null && !session.pinnedAt,
          )}
        >
          <ErrorNotice error={chats.error} />
        </SidebarSessionSection>
        <div className="sidebar-heading">
          <button
            type="button"
            className="sidebar-projects-label"
            onClick={(event) => {
              flushSync(() => setProjectsExpanded(true));
              scrollSidebarSection(
                event.currentTarget.parentElement!,
                ".sidebar-projects .project-item",
              );
            }}
          >
            {t("projects")}
          </button>
          <button
            type="button"
            className="sidebar-projects-toggle"
            aria-label={t("toggleProjects")}
            aria-expanded={projectsExpanded}
            aria-controls={projectsId}
            onClick={() => setProjectsExpanded((expanded) => !expanded)}
          >
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
          {!isRemoteClient() && (
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
          )}
        </div>
        <div className="sidebar-projects" id={projectsId} ref={projectList}>
          {projectsExpanded && (
            <>
              {projects.isPending && <p>{t("loading")}</p>}
              <ErrorNotice error={projects.error} />
              {projects.data?.slice(0, visibleProjects).map((project) => (
                <ProjectItem key={project.id} project={project} />
              ))}
              {(projects.data?.length ?? 0) > visibleProjects && (
                <ActionButton
                  className="session-show-more ghost"
                  onClick={() => setVisibleProjects((count) => count + 10)}
                >
                  {t("showMoreSessions")}
                </ActionButton>
              )}
              {projects.data?.length === 0 && !isRemoteClient() && (
                <ActionButton className="sidebar-empty" onClick={() => setAdding(true)}>
                  {t("noProjects")}
                </ActionButton>
              )}
            </>
          )}
        </div>
      </div>
      <footer>
        <SidebarMenu onOpenSettings={() => setSettingsOpen(true)} />
      </footer>
      {adding && (
        <AddProjectDialog
          onAdded={(project) => {
            useWorkspace.getState().expand(project.id, true);
            setProjectsExpanded(true);
            setVisibleProjects(Number.MAX_SAFE_INTEGER);
            setAddedProjectId(project.id);
          }}
          onClose={() => setAdding(false)}
        />
      )}
      {settingsOpen && (
        <Suspense fallback={<p role="status">{t("loading")}</p>}>
          <SettingsDialog onClose={() => setSettingsOpen(false)} />
        </Suspense>
      )}
    </aside>
  );
};
