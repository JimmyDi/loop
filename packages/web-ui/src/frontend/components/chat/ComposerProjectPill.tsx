import type { Ref } from "react";
import { useTranslation } from "react-i18next";

import type { Project } from "../../../shared/protocol";
import { ProjectSourceIcon } from "../projects/ProjectSourceIcon";
import "./ComposerProjectPill.css";

export const ComposerProjectPill = ({
  project,
  disabled,
  expanded,
  triggerRef,
  onChoose,
  onRemove,
}: {
  project?: Project;
  disabled: boolean;
  expanded: boolean;
  triggerRef: Ref<HTMLButtonElement>;
  onChoose(): void;
  onRemove(): void;
}) => {
  const { t } = useTranslation();
  return (
    <div className="composer-project-pill" data-selected={Boolean(project)}>
      {project && (
        <button
          type="button"
          className="composer-project-remove"
          disabled={disabled}
          aria-label={t("clearComposerProject", { name: project.name })}
          onClick={onRemove}
        >
          <ProjectSourceIcon kind="remove" />
        </button>
      )}
      <button
        type="button"
        ref={triggerRef}
        className="composer-project-trigger"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={expanded}
        title={project?.cwd}
        onClick={onChoose}
        onKeyDown={(event) => {
          if (["ArrowUp", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            onChoose();
          }
        }}
      >
        <ProjectSourceIcon kind="folder" />
        <span>{project?.name ?? t("chooseProject")}</span>
      </button>
    </div>
  );
};
