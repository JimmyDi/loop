import { useState } from "react";

import { useLanguage } from "../i18n/useLanguage";
import { LegalDialog } from "./LegalDialog";
import layout from "./Layout.module.css";
import styles from "./SiteFooter.module.css";

export const SiteFooter = () => {
  const { t } = useLanguage();
  const [legal, setLegal] = useState<"privacy" | "terms">();
  return (
    <footer className={[styles["site-footer"], layout.shell].join(" ")}>
      <div className={styles["social-space"]} aria-hidden="true" />
      <p>{t("footerCopyright")}</p>
      <nav aria-label={t("footerNavigation")}>
        <button type="button" onClick={() => setLegal("privacy")}>
          {t("privacyPolicy")}
        </button>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={() => setLegal("terms")}>
          {t("termsOfUse")}
        </button>
      </nav>
      {legal && <LegalDialog kind={legal} onClose={() => setLegal(undefined)} />}
    </footer>
  );
};
