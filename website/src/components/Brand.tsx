import { useLanguage } from "../i18n/useLanguage";
import { asset } from "../assets";
import styles from "./Brand.module.css";
import { BrandArtwork } from "./BrandArtwork";

export const Brand = () => {
  const { t } = useLanguage();
  return (
    <a className={styles.brand} href={asset("")} aria-label={t("home")}>
      <BrandArtwork size={48} />
      <span>Loop</span>
    </a>
  );
};
