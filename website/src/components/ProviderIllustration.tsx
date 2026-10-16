import { asset } from "../assets";
import { useLanguage } from "../i18n/useLanguage";
import { providerDemoFrames } from "./provider-demo";
import styles from "./ProviderIllustration.module.css";
import { useDemoPlayback } from "./useDemoPlayback";

export const ProviderIllustration = () => {
  const { language, t } = useLanguage();
  const playback = useDemoPlayback(providerDemoFrames);

  return (
    <div className={styles["provider-visual"]} ref={playback.root}>
      <div className={styles.frames} role="img" aria-label={t("providerDemoDescription")}>
        {providerDemoFrames.map((frame, index) => (
          <picture
            className={styles.frame}
            data-active={index === playback.frame}
            key={frame.image}
            aria-hidden="true"
          >
            <source
              media="(prefers-color-scheme: dark)"
              srcSet={asset(`provider-demo/${frame.image}-${language}-dark.webp`)}
            />
            <img
              src={asset(`provider-demo/${frame.image}-${language}-light.webp`)}
              alt=""
              width={1000}
              height={660}
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
          aria-label={t(playback.playing ? "providerDemoPause" : "providerDemoPlay")}
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
