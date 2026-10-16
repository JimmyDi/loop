import { asset } from "../assets";
import { useLanguage } from "../i18n/useLanguage";
import { workflowDemoFrames } from "./workflow-demo";
import styles from "./QueueIllustration.module.css";
import { useDemoPlayback } from "./useDemoPlayback";

export const QueueIllustration = () => {
  const { language, t } = useLanguage();
  const playback = useDemoPlayback(workflowDemoFrames);

  return (
    <div className={styles["queue-visual"]} ref={playback.root}>
      <div className={styles.frames} role="img" aria-label={t("workflowDemoDescription")}>
        {workflowDemoFrames.map((frame, index) => (
          <picture
            className={styles.frame}
            data-active={index === playback.frame}
            key={frame.image}
            aria-hidden="true"
          >
            <source
              media="(prefers-color-scheme: dark)"
              srcSet={asset(`workflow-demo/${frame.image}-${language}-dark.webp`)}
            />
            <img
              src={asset(`workflow-demo/${frame.image}-${language}-light.webp`)}
              alt=""
              width={1056}
              height={696}
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
          aria-label={t(playback.playing ? "workflowDemoPause" : "workflowDemoPlay")}
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
