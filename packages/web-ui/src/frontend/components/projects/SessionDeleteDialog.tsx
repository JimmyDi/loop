import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { Modal } from "../ui/Modal";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import "./SessionDeleteDialog.css";

export const SessionDeleteDialog = ({
  pending,
  error,
  onClose,
  onConfirm,
}: {
  pending: boolean;
  error: unknown;
  onClose(): void;
  onConfirm(): void;
}) => {
  const { t } = useTranslation();
  return createPortal(
    <Modal
      title={t("deleteSessionTitle")}
      className="session-delete-dialog"
      closeLabel={t("close")}
      closeDisabled={pending}
      onClose={onClose}
    >
      <p>{t("deleteSessionDescription")}</p>
      <ErrorNotice error={error} />
      <footer>
        <ActionButton className="ghost" disabled={pending} onClick={onClose}>
          {t("cancel")}
        </ActionButton>
        <ActionButton className="session-delete-confirm" disabled={pending} onClick={onConfirm}>
          {t(pending ? "loading" : "delete")}
        </ActionButton>
      </footer>
    </Modal>,
    document.body,
  );
};
