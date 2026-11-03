import { useState } from "react";

import { blogPath } from "../blog/blog-location";
import { asset } from "../assets";
import { useLanguage } from "../i18n/useLanguage";
import { LegalDialog } from "./LegalDialog";
import layout from "./Layout.module.css";
import styles from "./SiteFooter.module.css";

export const SiteFooter = () => {
  const { t, language } = useLanguage();
  const [legal, setLegal] = useState<"privacy" | "terms">();
  return (
    <footer className={[styles["site-footer"], layout.shell].join(" ")}>
      <div className={styles["social-space"]}>
        <a href={asset(blogPath("blog/", language))}>{t("blog")}</a>
      </div>
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
