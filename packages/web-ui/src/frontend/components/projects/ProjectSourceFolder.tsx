import { useTranslation } from "react-i18next";

import { ActionButton } from "../ui/ActionButton";
import { ProjectSourceIcon } from "./ProjectSourceIcon";
import "./ProjectSourceFolder.css";

export const ProjectSourceFolder = ({
  path,
  disabled,
  onRemove,
}: {
  path: string;
  disabled: boolean;
  onRemove(): void;
}) => {
  const { t } = useTranslation();
  const name =
    path
      .replace(/[\\/]+$/, "")
      .split(/[\\/]/)
      .pop() || path;
  const removeLabel = t("removeSourceFolder", { name });

  return (
    <div className="project-source-folder">
      <ProjectSourceIcon kind="folder" />
      <span className="project-source-name" title={path}>
        {name}
      </span>
      <ActionButton
        className="project-source-remove ghost"
        aria-label={removeLabel}
        title={removeLabel}
        disabled={disabled}
        onClick={onRemove}
      >
        <ProjectSourceIcon kind="remove" />
      </ActionButton>
    </div>
  );
};
