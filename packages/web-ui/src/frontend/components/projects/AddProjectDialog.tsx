import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Project } from "../../../shared/protocol";
import { useProjects } from "../../hooks/useProjects";
import { useDirectoryPicker } from "../../hooks/useDirectoryPicker";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { Modal } from "../ui/Modal";
import { DirectoryBrowser } from "./DirectoryBrowser";
import "./AddProjectDialog.css";

export const AddProjectDialog = ({
  onAdded,
  onClose,
}: {
  onAdded(project: Project): void;
  onClose(): void;
}) => {
  const { t } = useTranslation();
  const { add } = useProjects();
  const [path, setPath] = useState("");
  const { capability, browsing, setBrowsing, picking, error, pick } = useDirectoryPicker(setPath);

  const save = async (path: string) => {
    if (add.isPending || !path.trim()) return;

    try {
      const project = await add.mutateAsync(path);
      onAdded(project);
      onClose();
    } catch {
      /* Mutation exposes the error below. */
    }
  };

  return (
    <Modal title={t("addProject")} onClose={onClose} closeDisabled={add.isPending}>
      <form
        className="add-project-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save(path);
        }}
      >
        <label>
          {t("directory")}
          <input
            value={path}
            disabled={add.isPending}
            onChange={(event) => setPath(event.target.value)}
          />
        </label>
        <div className="project-dialog-actions">
          {capability.data?.native && (
            <ActionButton disabled={picking || add.isPending} onClick={() => void pick()}>
              {t("nativePicker")}
            </ActionButton>
          )}
          <ActionButton disabled={add.isPending} onClick={() => setBrowsing(!browsing)}>
            {t("browse")}
          </ActionButton>
          <ActionButton type="submit" className="primary" disabled={!path.trim() || add.isPending}>
            {t("addProject")}
          </ActionButton>
          <ActionButton disabled={add.isPending} onClick={onClose}>
            {t("cancel")}
          </ActionButton>
        </div>
      </form>
      <ErrorNotice error={error ?? add.error} />
      {browsing && (
        <DirectoryBrowser
          onSelect={(value) => {
            setPath(value);
            setBrowsing(false);
          }}
        />
      )}
    </Modal>
  );
};
