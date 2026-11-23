import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { Modal } from "../ui/Modal";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import "./EchoComputerDeleteDialog.css";

export const EchoComputerDeleteDialog = ({
  computerId,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  computerId: string;
  pending: boolean;
  error: unknown;
  onClose(): void;
  onConfirm(): void;
}) => {
  const { i18n } = useTranslation();
  const zh = i18n.language.startsWith("zh");
  return createPortal(
    <Modal
      title={zh ? "删除电脑" : "Delete computer"}
      className="echo-computer-delete-dialog"
      closeLabel={zh ? "关闭" : "Close"}
      closeDisabled={pending}
      onClose={onClose}
    >
      <p>
        {zh
          ? "删除电脑 " +
            computerId.slice(0, 8) +
            "？这会解除所有对话的绑定并释放电脑名额。文件卷会保留。"
          : "Delete computer " +
            computerId.slice(0, 8) +
            "? This removes its conversation bindings and frees a computer slot. File volumes are retained."}
      </p>
      <ErrorNotice error={error} />
      <footer>
        <ActionButton className="ghost" disabled={pending} onClick={onClose}>
          {zh ? "取消" : "Cancel"}
        </ActionButton>
        <ActionButton
          className="echo-computer-delete-confirm"
          disabled={pending}
          onClick={onConfirm}
        >
          {pending ? (zh ? "删除中…" : "Deleting…") : zh ? "删除电脑" : "Delete computer"}
        </ActionButton>
      </footer>
    </Modal>,
    document.body,
  );
};
