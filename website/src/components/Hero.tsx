import { useRef } from "react";

import { useLanguage } from "../i18n/useLanguage";
import { CopyCommand } from "./CopyCommand";
import { HeroBackground } from "./HeroBackground";
import { HeroPointer } from "./HeroPointer";
import layout from "./Layout.module.css";
import { ProductPreview } from "./ProductPreview";
import styles from "./Hero.module.css";

export const Hero = () => {
  const { t } = useLanguage();
  const hostRef = useRef<HTMLElement>(null);
  return (
    <section className={styles.hero} aria-labelledby="hero-title" ref={hostRef}>
      <HeroBackground />
      <HeroPointer hostRef={hostRef} />
      <div className={styles["hero-intro"]}>
        <div className={styles["hero-content"]}>
          <h1 id="hero-title" className={layout["responsive-title"]}>
            <span data-pointer-clear>{t("heroFirst")}</span>
            <span className={styles["hero-ending"]} data-pointer-clear>
              {t("heroJoin")}
              <span className={styles["hero-emphasis"]}>{t("heroLast")}</span>
            </span>
          </h1>
          <p className={[styles["hero-description"], layout["responsive-copy"]].join(" ")}>
            <span data-pointer-clear>{t("heroDescription")}</span>{" "}
            <span data-pointer-clear>{t("heroProduct")}</span>
          </p>
          <CopyCommand />
        </div>
      </div>
      <ProductPreview />
    </section>
  );
};
