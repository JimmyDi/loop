import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useProjects } from "../../hooks/useProjects";
import { useWorkspace } from "../../state/workspace-store";
import { AddProjectDialog } from "../projects/AddProjectDialog";
import { ProjectItem } from "../projects/ProjectItem";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { LanguageSelect } from "./LanguageSelect";
import { ProviderSettingsDialog } from "../settings/ProviderSettingsDialog";
import "./Sidebar.css";

export const Sidebar = () => {
  const { t } = useTranslation();
  const { projects } = useProjects();
  const [adding, setAdding] = useState(false);
  const [configuring, setConfiguring] = useState(false);
  const toggle = useWorkspace((state) => state.toggleSidebar);

  return (
    <aside className="sidebar" aria-label={t("projects")}>
      <div className="sidebar-brand">
        <span className="loop-logo">∞</span>
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
        <span>{t("projects")}</span>
        <ActionButton
          className="ghost"
          aria-label={t("addProject")}
          onClick={() => setAdding(true)}
        >
          ＋
        </ActionButton>
      </div>
      <div className="sidebar-projects">
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
      </div>
      <footer>
        <ActionButton className="ghost" onClick={() => setConfiguring(true)}>
          {t("providerSettings")}
        </ActionButton>
        <LanguageSelect />
      </footer>
      {adding && <AddProjectDialog onClose={() => setAdding(false)} />}
      {configuring && <ProviderSettingsDialog onClose={() => setConfiguring(false)} />}
    </aside>
  );
};
