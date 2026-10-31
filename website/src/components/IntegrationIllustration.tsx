import { asset } from "../assets";
import { useLanguage } from "../i18n/useLanguage";
import { integrationDemoFrames } from "./integration-demo";
import styles from "./IntegrationIllustration.module.css";
import { useDemoPlayback } from "./useDemoPlayback";

export const IntegrationIllustration = () => {
  const { language, t } = useLanguage();
  const playback = useDemoPlayback(integrationDemoFrames);

  return (
    <div className={styles["integration-visual"]} ref={playback.root}>
      <div className={styles.frames} role="img" aria-label={t("integrationDemoDescription")}>
        {integrationDemoFrames.map((frame, index) => (
          <picture
            className={styles.frame}
            data-active={index === playback.frame}
            key={frame.image}
            aria-hidden="true"
          >
            <source
              media="(prefers-color-scheme: dark)"
              srcSet={asset(`integration-demo/${frame.image}-${language}-dark.webp`)}
            />
            <img
              src={asset(`integration-demo/${frame.image}-${language}-light.webp`)}
              alt=""
              width={1020}
              height={604}
              loading="lazy"
              decoding="async"
            />
          </picture>
        ))}
      </div>
      {!playback.reduced && (
        <button
          type="button"
          className={styles.playback}
          aria-label={t(playback.playing ? "integrationDemoPause" : "integrationDemoPlay")}
          onClick={playback.toggle}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            {playback.playing ? (
              <path d="M8 5v14M16 5v14" fill="none" stroke="currentColor" strokeWidth="2" />
            ) : (
              <path d="m8 5 11 7-11 7Z" fill="currentColor" />
            )}
          </svg>
        </button>
      )}
    </div>
  );
};
