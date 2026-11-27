import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { Modal } from "../ui/Modal";
import "./ScheduleRunDelete.css";

export const ScheduleRunDelete = ({
  pending,
  error,
  close,
  confirm,
}: {
  pending: boolean;
  error: unknown;
  close(): void;
  confirm(): void;
}) => {
  const { t } = useTranslation();
  return createPortal(
    <Modal
      title={t("scheduleDeleteRunTitle")}
      closeLabel={t("close")}
      closeDisabled={pending}
      onClose={close}
    >
      <p>{t("scheduleDeleteRunDescription")}</p>
      <ErrorNotice error={error} />
      <footer className="automation-run-confirm">
        <ActionButton disabled={pending} onClick={close}>
          {t("cancel")}
        </ActionButton>
        <ActionButton disabled={pending} onClick={confirm}>
          {t("deletePermanently")}
        </ActionButton>
      </footer>
    </Modal>,
    document.body,
  );
};
