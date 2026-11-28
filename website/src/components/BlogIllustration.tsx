import { asset } from "../assets";
import { useLanguage } from "../i18n/useLanguage";
import styles from "./BlogIllustration.module.css";

const illustrations: Record<string, { src: string; height: number; zh: string; en: string }> = {
  "local-voice-167-mib": {
    src: "blog/local-voice-167-mib/illustration",
    height: 1024,
    zh: "本地语音输入插画",
    en: "Local voice input illustration",
  },
  "openui-generative-chat": {
    src: "blog/openui-generative-chat/cover",
    height: 864,
    zh: "油画风格的聊天界面，展示柱状图和表单",
    en: "Oil painting of a chat interface with a bar chart and a form",
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
      height={illustration.height}
      loading="lazy"
      decoding="async"
    />
  );
};
