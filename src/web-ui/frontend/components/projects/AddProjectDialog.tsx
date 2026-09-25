import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useProjects } from "../../hooks/useProjects";
import { useDirectoryPicker } from "../../hooks/useDirectoryPicker";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { Modal } from "../ui/Modal";
import { DirectoryBrowser } from "./DirectoryBrowser";
import "./AddProjectDialog.css";

export const AddProjectDialog = ({ onClose }: { onClose(): void }) => {
  const { t } = useTranslation();
  const { add } = useProjects();
  const [path, setPath] = useState("");
  const { capability, browsing, setBrowsing, picking, error, pick } = useDirectoryPicker(setPath);

  const save = async (path: string) => {
    try {
      await add.mutateAsync(path);
      onClose();
    } catch {
      /* Mutation exposes the error below. */
    }
  };

  return (
    <Modal title={t("addProject")} onClose={onClose}>
      <form
        className="add-project-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save(path);
        }}
      >
        <label>
          {t("directory")}
          <input value={path} onChange={(event) => setPath(event.target.value)} />
        </label>
        <div className="project-dialog-actions">
          {capability.data?.native && (
            <ActionButton disabled={picking} onClick={() => void pick()}>
              {t("nativePicker")}
            </ActionButton>
          )}
          <ActionButton onClick={() => setBrowsing(!browsing)}>{t("browse")}</ActionButton>
          <ActionButton type="submit" className="primary" disabled={!path.trim() || add.isPending}>
            {t("addProject")}
          </ActionButton>
          <ActionButton onClick={onClose}>{t("cancel")}</ActionButton>
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
