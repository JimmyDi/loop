import { asset } from "../assets";
import { useLanguage } from "../i18n/useLanguage";
import styles from "./BlogIllustration.module.css";

const illustrations: Record<string, { src: string; zh: string; en: string }> = {
  "local-voice-167-mib": {
    src: "blog/local-voice-167-mib/illustration",
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
      src={asset(`${illustration.src}-960.webp`)}
      srcSet={[480, 960, 1536]
        .map((width) => `${asset(`${illustration.src}-${width}.webp`)} ${width}w`)
        .join(", ")}
      sizes="(max-width: 600px) calc(100vw - 88px), (max-width: 1100px) 40vw, 400px"
      alt={illustration[language]}
      width={1536}
      height={1024}
      loading="lazy"
      decoding="async"
    />
  );
};
