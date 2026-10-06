import { useTranslation } from "react-i18next";

import type { Project } from "../../../shared/protocol";
import { useCreateProject } from "../../hooks/useCreateProject";
import { ErrorNotice } from "../ui/ErrorNotice";
import { Modal } from "../ui/Modal";
import { CreateProjectActions } from "./CreateProjectActions";
import { ProjectNameInput } from "./ProjectNameInput";
import { ProjectSourceFolders } from "./ProjectSourceFolders";
import "./AddProjectDialog.css";

export const AddProjectDialog = ({
  onAdded,
  onClose,
}: {
  onAdded(project: Project): void;
  onClose(): void;
}) => {
  const { t } = useTranslation();
  const project = useCreateProject((created) => {
    onAdded(created);
    onClose();
  });

  return (
    <Modal
      title={t("createProject")}
      className="create-project-dialog"
      closeLabel={t("close")}
      onClose={onClose}
      closeDisabled={project.saving}
    >
      <form
        className="create-project-form"
        onSubmit={(event) => {
          event.preventDefault();
          void project.create();
        }}
      >
        <ProjectNameInput
          ref={project.nameInput}
          value={project.name}
          disabled={project.saving}
          onChange={project.changeName}
        />
        <div className="create-project-content">
          <ProjectSourceFolders
            path={project.path}
            picking={project.picking}
            disabled={project.saving}
            onAdd={() => void project.pickFolder()}
            onRemove={project.removeFolder}
          />
          <ErrorNotice error={project.error} />
        </div>
        <CreateProjectActions
          saving={project.saving}
          canCreate={project.canCreate}
          onCancel={onClose}
        />
      </form>
    </Modal>
  );
};
