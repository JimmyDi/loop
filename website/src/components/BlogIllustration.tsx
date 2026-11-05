import { asset } from "../assets";
import { useLanguage } from "../i18n/useLanguage";
import styles from "./BlogIllustration.module.css";

const illustrations: Record<string, { src: string; zh: string; en: string }> = {
  "local-voice-167-mib": {
    src: "blog/local-voice-167-mib/illustration.png",
    zh: "本地语音输入插画",
    en: "Local voice input illustration",
  },
};

export const BlogIllustration = ({ slug }: { slug: string }) => {
  const { language } = useLanguage();
  const illustration = illustrations[slug];
  if (!illustration) return null;
  return (
    <img
      className={styles.illustration}
      src={asset(illustration.src)}
      alt={illustration[language]}
      width={1536}
      height={1024}
      loading="lazy"
      decoding="async"
    />
  );
};
