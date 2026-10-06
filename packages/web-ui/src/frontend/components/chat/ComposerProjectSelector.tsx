import { useState } from "react";

import type { Project } from "../../../shared/protocol";
import type { useComposerProject } from "../../hooks/useComposerProject";
import { useComposerMenu } from "../../hooks/useComposerMenu";
import { useProjectPopoverHeight } from "../../hooks/useProjectPopoverHeight";
import { AddProjectDialog } from "../projects/AddProjectDialog";
import { ErrorNotice } from "../ui/ErrorNotice";
import { ComposerProjectMenu } from "./ComposerProjectMenu";
import { ComposerProjectPill } from "./ComposerProjectPill";
import "./ComposerProjectSelector.css";

export const ComposerProjectSelector = ({
  selection,
  disabled,
}: {
  selection: ReturnType<typeof useComposerProject>;
  disabled: boolean;
}) => {
  const menu = useComposerMenu(disabled, selection.pending);
  const maxHeight = useProjectPopoverHeight(Boolean(menu.page), menu.root);
  const [adding, setAdding] = useState(false);
  const choose = async (project: Project) => {
    if (!disabled && (await selection.select(project))) menu.close();
  };
  return (
    <div className="composer-project-selector" ref={menu.root}>
      <ComposerProjectPill
        project={selection.project}
        disabled={disabled || selection.pending}
        expanded={Boolean(menu.page)}
        triggerRef={menu.trigger}
        onChoose={() => (menu.page ? menu.close() : menu.setPage("main"))}
        onRemove={() => {
          selection.clear();
          menu.close();
        }}
      />
      {menu.page && (
        <div
          className="composer-project-popover"
          style={{ maxHeight }}
          ref={menu.panel}
          onKeyDown={menu.navigate}
        >
          <ComposerProjectMenu
            projects={selection.projects.data ?? []}
            current={selection.project?.id}
            disabled={disabled || selection.pending}
            onSelect={(project) => void choose(project)}
            onAdd={() => {
              menu.close();
              setAdding(true);
            }}
          />
          <ErrorNotice error={selection.projects.error ?? selection.error} />
        </div>
      )}
      {adding && (
        <AddProjectDialog
          onAdded={(project) => void choose(project)}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
};
