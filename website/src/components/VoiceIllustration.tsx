import { asset } from "../assets";
import { useLanguage } from "../i18n/useLanguage";
import styles from "./VoiceIllustration.module.css";

export const VoiceIllustration = () => {
  const { language, t } = useLanguage();
  return (
    <picture className={styles.visual}>
      <source
        media="(prefers-color-scheme: dark)"
        srcSet={asset(`voice-demo/queued-input-${language}-dark.webp`)}
      />
      <img
        src={asset(`voice-demo/queued-input-${language}-light.webp`)}
        alt={t("voicePreview")}
        width={1000}
        height={660}
        loading="lazy"
        decoding="async"
      />
    </picture>
  );
};
