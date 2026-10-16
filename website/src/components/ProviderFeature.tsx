import { useLanguage } from "../i18n/useLanguage";
import { FeatureCard } from "./FeatureCard";
import styles from "./ProviderFeature.module.css";
import { ProviderIllustration } from "./ProviderIllustration";

export const ProviderFeature = () => {
  const { t } = useLanguage();
  return (
    <FeatureCard
      copyClassName={styles.copy}
      title={
        <>
          <span>{t("providersTitle")}</span>
          <span>{t("providersChoice")}</span>
        </>
      }
      description={t("providersDescription")}
    >
      <ProviderIllustration />
    </FeatureCard>
  );
};
