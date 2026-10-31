import { useLanguage } from "../i18n/useLanguage";
import styles from "./Capabilities.module.css";
import { FeatureCard } from "./FeatureCard";
import { IntegrationIllustration } from "./IntegrationIllustration";
import layout from "./Layout.module.css";
import { ProviderFeature } from "./ProviderFeature";
import { QueueIllustration } from "./QueueIllustration";
import { SectionHeading } from "./SectionHeading";
import { RemoteIllustration } from "./RemoteIllustration";
import { VoiceIllustration } from "./VoiceIllustration";

export const Capabilities = () => {
  const { t } = useLanguage();
  return (
    <section
      id="capabilities"
      className={[styles.capabilities, layout.shell].join(" ")}
      aria-labelledby="capabilities-title"
    >
      <SectionHeading
        id="capabilities-title"
        first={t("capabilitiesFirst")}
        last={t("capabilitiesLast")}
        description={[t("capabilitiesDescription")]}
      />
      <div className={styles["feature-grid"]}>
        <FeatureCard
          title={<span className={styles["remote-title"]}>{t("remoteTitle")}</span>}
          description={t("remoteDescription")}
          details={<p className={styles["continuity-copy"]}>{t("remoteLimits")}</p>}
        >
          <RemoteIllustration />
        </FeatureCard>
        <FeatureCard
          title={t("voiceTitle")}
          description={t("voiceDescription")}
          details={<p className={styles["continuity-copy"]}>{t("voiceLimits")}</p>}
        >
          <VoiceIllustration />
        </FeatureCard>
        <FeatureCard title={t("queueTitle")} description={t("queueContinuity")}>
          <QueueIllustration />
        </FeatureCard>
        <ProviderFeature />
        <FeatureCard title={t("integrationTitle")} description={t("integrationDescription")}>
          <IntegrationIllustration />
        </FeatureCard>
      </div>
    </section>
  );
};
