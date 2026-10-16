import { useLanguage } from "../i18n/useLanguage";
import styles from "./Capabilities.module.css";
import { FeatureCard } from "./FeatureCard";
import { IntegrationIllustration } from "./IntegrationIllustration";
import layout from "./Layout.module.css";
import { ProviderFeature } from "./ProviderFeature";
import { QueueIllustration } from "./QueueIllustration";

export const Capabilities = () => {
  const { t } = useLanguage();
  return (
    <section
      id="capabilities"
      className={[styles.capabilities, layout.shell].join(" ")}
      aria-labelledby="capabilities-title"
    >
      <div className={styles["section-heading"]}>
        <h2 id="capabilities-title">
          {t("capabilitiesFirst")} {t("capabilitiesLast")}
        </h2>
      </div>
      <div className={styles["feature-grid"]}>
        <ProviderFeature />
        <FeatureCard title={t("queueTitle")} description={t("queueContinuity")}>
          <QueueIllustration />
        </FeatureCard>
        <FeatureCard
          title={t("integrationTitle")}
          description={t("integrationDescription")}
          details={<p className={styles["continuity-copy"]}>{t("integrationWorkflow")}</p>}
        >
          <IntegrationIllustration />
        </FeatureCard>
      </div>
    </section>
  );
};
