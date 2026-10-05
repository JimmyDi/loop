import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { Modal } from "../ui/Modal";
import "./ProjectConfirmation.css";

export const ProjectConfirmation = ({
  action,
  name,
  count,
  pending,
  loading,
  error,
  drafts,
  onClose,
  onConfirm,
}: {
  action: "archive" | "remove";
  name: string;
  count: number;
  pending: boolean;
  loading: boolean;
  error: unknown;
  drafts: boolean;
  onClose(): void;
  onConfirm(): void;
}) => {
  const { t } = useTranslation();
  return createPortal(
    <Modal
      title={t(action === "archive" ? "archiveChatsTitle" : "removeProjectTitle", { count, name })}
      className="project-confirmation"
      closeLabel={t("close")}
      closeDisabled={pending}
      onClose={onClose}
    >
      <p>
        {t(action === "archive" ? "archiveChatsDescription" : "removeProjectDescription", { name })}
      </p>
      {action === "remove" && drafts && <p>{t("draftConfirm")}</p>}
      {loading && <p role="status">{t("loading")}</p>}
      <ErrorNotice error={error} />
      <div className="project-confirmation-actions">
        <ActionButton className="ghost" disabled={pending} onClick={onClose}>
          {t("cancel")}
        </ActionButton>
        <ActionButton
          className="project-confirmation-submit"
          disabled={pending || loading || (action === "archive" && count === 0)}
          onClick={onConfirm}
        >
          {t(pending ? "loading" : action === "archive" ? "archiveAll" : "removeProject")}
        </ActionButton>
      </div>
    </Modal>,
    document.body,
  );
};
