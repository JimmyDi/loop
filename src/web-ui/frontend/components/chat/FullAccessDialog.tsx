import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { Modal } from "../ui/Modal";
import "./FullAccessDialog.css";

export const FullAccessDialog = ({
  pending,
  disabled,
  error,
  onClose,
  confirm,
  scope = "session",
}: {
  pending: boolean;
  disabled: boolean;
  error?: unknown;
  onClose(): void;
  confirm(): Promise<void>;
  scope?: "session" | "default";
}) => {
  const { t } = useTranslation();
  return createPortal(
    <Modal
      className="full-access-dialog"
      title={t(scope === "default" ? "permissions.defaultFullTitle" : "permissions.fullTitle")}
      onClose={onClose}
      closeDisabled={pending}
    >
      <p className="full-access-description">
        {t(scope === "default" ? "permissions.defaultFullWarning" : "permissions.fullWarning")}
      </p>
      <div className="full-access-scopes">
        {["files", "commands", "network"].map((scope) => (
          <div className="full-access-scope" key={scope}>
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {scope === "files" ? (
                <path d="M3 7V5h6l2 2h10v13H3V7Zm0 3h18" />
              ) : scope === "commands" ? (
                <>
                  <rect x="3" y="4" width="18" height="16" rx="3" />
                  <path d="m7 9 3 3-3 3m6 0h4" />
                </>
              ) : (
                <>
                  <circle cx="12" cy="12" r="9" />
                  <ellipse cx="12" cy="12" rx="4" ry="9" />
                  <path d="M3 12h18" />
                </>
              )}
            </svg>
            <div>
              <strong>{t(`permissions.${scope}Title`)}</strong>
              <p>{t(`permissions.${scope}Description`)}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="full-access-description">
        {t(scope === "default" ? "permissions.defaultFullRisk" : "permissions.fullRisk")}
      </p>
      <ErrorNotice error={error} />
      <footer>
        <ActionButton disabled={pending} onClick={onClose}>
          {t("cancel")}
        </ActionButton>
        <ActionButton
          className="full-access-confirm"
          disabled={disabled || pending}
          onClick={() => void confirm()}
        >
          {pending ? t("saving") : t("permissions.confirmFull")}
        </ActionButton>
      </footer>
    </Modal>,
    document.body,
  );
};
