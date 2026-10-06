import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Project } from "../../../shared/protocol";
import { ProjectSourceIcon } from "../projects/ProjectSourceIcon";
import { ComposerProjectSearch } from "./ComposerProjectSearch";
import "./ComposerProjectMenu.css";

export const ComposerProjectMenu = ({
  projects,
  current,
  disabled,
  onSelect,
  onAdd,
}: {
  projects: Project[];
  current?: string;
  disabled: boolean;
  onSelect(project: Project): void;
  onAdd(): void;
}) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const matches = projects.filter((project) =>
    project.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <>
      <ComposerProjectSearch value={search} disabled={disabled} onChange={setSearch} />
      <div className="composer-project-menu" role="menu" aria-label={t("chooseProject")}>
        <div className="composer-project-choices">
          {matches.map((project) => (
            <button
              key={project.id}
              type="button"
              role="menuitemradio"
              tabIndex={-1}
              aria-checked={project.id === current}
              disabled={disabled || project.accessible === false}
              title={project.cwd}
              onClick={() => onSelect(project)}
            >
              <ProjectSourceIcon kind="folder" />
              <span>{project.name}</span>
              {project.id === current && <span aria-hidden="true">✓</span>}
            </button>
          ))}
          {!matches.length && (
            <p className="composer-project-empty" role="status">
              {t("noMatchingProjects")}
            </p>
          )}
        </div>
        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          className="composer-project-add"
          disabled={disabled}
          onClick={onAdd}
        >
          <ProjectSourceIcon kind="add" />
          <span>{t("addProjectFolder")}</span>
        </button>
      </div>
    </>
  );
};
