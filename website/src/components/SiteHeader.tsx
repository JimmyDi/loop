import { useRef } from "react";

import { Brand } from "./Brand";
import { LanguageSwitch } from "./LanguageSwitch";
import styles from "./SiteHeader.module.css";
import { useHeaderScroll } from "./useHeaderScroll";

export const SiteHeader = () => {
  const headerRef = useRef<HTMLElement>(null);
  useHeaderScroll(headerRef);
  return (
    <header className={styles["site-header"]} ref={headerRef}>
      <div className={styles.bar}>
        <Brand />
        <LanguageSwitch />
      </div>
    </header>
  );
};
