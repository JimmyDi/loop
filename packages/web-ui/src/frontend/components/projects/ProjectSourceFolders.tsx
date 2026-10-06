import { useTranslation } from "react-i18next";

import { ActionButton } from "../ui/ActionButton";
import { ProjectSourceFolder } from "./ProjectSourceFolder";
import { ProjectSourceIcon } from "./ProjectSourceIcon";
import "./ProjectSourceFolders.css";

export const ProjectSourceFolders = ({
  path,
  picking,
  disabled,
  onAdd,
  onRemove,
}: {
  path: string;
  picking: boolean;
  disabled: boolean;
  onAdd(): void;
  onRemove(): void;
}) => {
  const { t } = useTranslation();

  return (
    <section className="project-source" aria-label={t("sourceFolders")}>
      <div className="project-source-heading">
        <h3>{t("sourceFolders")}</h3>
        {path && (
          <span className="project-source-computer">
            <ProjectSourceIcon kind="computer" />
            {t("thisComputer")}
          </span>
        )}
      </div>
      <div className={"project-source-box" + (path ? " has-folder" : "")}>
        {path ? (
          <ProjectSourceFolder path={path} disabled={disabled} onRemove={onRemove} />
        ) : (
          <>
            <p>{t("addFolderOnComputer")}</p>
            <ActionButton
              className="project-source-add"
              disabled={picking || disabled}
              onClick={onAdd}
            >
              <ProjectSourceIcon kind="add" />
              {t(picking ? "choosingFolder" : "addSourceFolder")}
            </ActionButton>
          </>
        )}
      </div>
    </section>
  );
};
