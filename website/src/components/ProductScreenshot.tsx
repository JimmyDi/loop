import { asset } from "../assets";
import type { Language } from "../translations";
import styles from "./ProductScreenshot.module.css";

export const ProductScreenshot = ({ language, label }: { language: Language; label: string }) => (
  <picture className={styles.screenshot}>
    <source
      media="(prefers-color-scheme: dark)"
      srcSet={asset(`product/storefront-filters-${language}-dark.webp`)}
    />
    <img
      src={asset(`product/storefront-filters-${language}-light.webp`)}
      alt={label}
      width={1440}
      height={800}
      decoding="async"
    />
  </picture>
);
