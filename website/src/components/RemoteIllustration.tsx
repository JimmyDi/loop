import { asset } from "../assets";
import { useLanguage } from "../i18n/useLanguage";
import styles from "./RemoteIllustration.module.css";

export const RemoteIllustration = () => {
  const { language, t } = useLanguage();
  return (
    <picture className={styles.visual}>
      <source
        media="(prefers-color-scheme: dark)"
        srcSet={asset(`remote-demo/pairing-${language}-dark.webp`)}
      />
      <img
        src={asset(`remote-demo/pairing-${language}-light.webp`)}
        alt={t("remotePreview")}
        width={1484}
        height={1080}
        loading="lazy"
        decoding="async"
      />
    </picture>
  );
};
