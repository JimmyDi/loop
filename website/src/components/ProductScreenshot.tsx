import { asset } from "../assets";
import type { Language } from "../translations";
import styles from "./ProductScreenshot.module.css";

const sizes =
  "(max-width: 700px) calc(100vw - 32px), (max-width: 900px) calc(100vw - clamp(32px, 7vw, 112px)), min(58vw, 1008px)";

const candidates = (language: Language, theme: "light" | "dark") => {
  const prefix = asset(`product/storefront-filters-${language}-${theme}`);
  return `${prefix}-480.webp 480w, ${prefix}-960.webp 960w, ${prefix}.webp 1440w`;
};

export const ProductScreenshot = ({ language, label }: { language: Language; label: string }) => (
  <picture className={styles.screenshot}>
    <source
      media="(prefers-color-scheme: dark)"
      srcSet={candidates(language, "dark")}
      sizes={sizes}
    />
    <img
      src={asset(`product/storefront-filters-${language}-light.webp`)}
      alt={label}
      srcSet={candidates(language, "light")}
      sizes={sizes}
      width={1440}
      height={800}
      decoding="async"
      fetchPriority="high"
    />
  </picture>
);
