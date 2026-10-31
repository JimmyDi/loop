import { useRef } from "react";

import { useLanguage } from "../i18n/useLanguage";
import { asset } from "../assets";
import { Brand } from "./Brand";
import { LanguageSwitch } from "./LanguageSwitch";
import styles from "./SiteHeader.module.css";
import { useHeaderScroll } from "./useHeaderScroll";

export const SiteHeader = () => {
  const { t } = useLanguage();
  const headerRef = useRef<HTMLElement>(null);
  useHeaderScroll(headerRef);
  return (
    <header className={styles["site-header"]} ref={headerRef}>
      <div className={styles.bar}>
        <div className={styles.primary}>
          <Brand />
          <nav className={styles.navigation} aria-label={t("mainNavigation")}>
            <a href={asset("docs/")}>{t("docs")}</a>
            <a href={asset("changelog/")}>{t("changelog")}</a>
          </nav>
        </div>
        <div className={styles.actions}>
          <a
            className={styles.github}
            href="https://github.com/JimmyDi/loop"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("githubRepository")}
            title={t("githubRepository")}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 .75a11.25 11.25 0 0 0-3.558 21.923c.563.103.768-.244.768-.542 0-.267-.01-.975-.015-1.913-3.13.68-3.79-1.51-3.79-1.51-.512-1.3-1.25-1.646-1.25-1.646-1.023-.7.078-.686.078-.686 1.13.08 1.724 1.16 1.724 1.16 1.005 1.723 2.637 1.225 3.28.937.102-.728.393-1.225.715-1.507-2.499-.284-5.126-1.25-5.126-5.565 0-1.23.44-2.234 1.16-3.022-.116-.285-.503-1.431.111-2.982 0 0 .945-.303 3.094 1.154a10.78 10.78 0 0 1 5.633 0c2.148-1.457 3.092-1.154 3.092-1.154.615 1.551.228 2.697.112 2.982.722.788 1.158 1.792 1.158 3.022 0 4.327-2.631 5.278-5.138 5.557.404.349.765 1.034.765 2.084 0 1.505-.014 2.72-.014 3.09 0 .3.203.65.774.54A11.25 11.25 0 0 0 12 .75Z"
              />
            </svg>
          </a>
          <LanguageSwitch />
        </div>
      </div>
    </header>
  );
};
