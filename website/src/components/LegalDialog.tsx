import { useEffect, useId, useRef } from "react";

import { useLanguage } from "../i18n/useLanguage";
import styles from "./LegalDialog.module.css";

export const LegalDialog = ({
  kind,
  onClose,
}: {
  kind: "privacy" | "terms";
  onClose: () => void;
}) => {
  const { t } = useLanguage();
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const paragraphs =
    kind === "privacy"
      ? (["privacyWebsite", "privacyBrowser", "privacyHosting"] as const)
      : (["termsWebsite", "termsLicense", "termsServices"] as const);
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      trigger?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className={styles.heading}>
        <h2 id={titleId}>{t(kind === "privacy" ? "privacyPolicy" : "termsOfUse")}</h2>
        <button type="button" onClick={onClose}>
          {t("closeLegal")}
        </button>
      </div>
      {paragraphs.map((key) => (
        <p key={key}>{t(key)}</p>
      ))}
    </dialog>
  );
};
