import { useTranslation } from "react-i18next";

import { Modal } from "../ui/Modal";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import "./ArchiveDeleteDialog.css";

export const ArchiveDeleteDialog = ({
  count,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  count: number;
  pending: boolean;
  error: unknown;
  onClose(): void;
  onConfirm(): void;
}) => {
  const { t } = useTranslation();
  return (
    <Modal
      className="archive-delete-dialog"
      title={t("deleteArchivedTitle", { count })}
      closeLabel={t("close")}
      closeDisabled={pending}
      onClose={onClose}
    >
      <p>{t("deleteArchivedDescription")}</p>
      <ErrorNotice error={error} />
      <footer>
        <ActionButton className="ghost" disabled={pending} onClick={onClose}>
          {t("cancel")}
        </ActionButton>
        <ActionButton
          className="archive-danger"
          disabled={pending || count === 0}
          onClick={onConfirm}
        >
          {t(pending ? "loading" : "deletePermanently")}
        </ActionButton>
      </footer>
    </Modal>
  );
};
