import { useId } from "react";

import { useLanguage } from "../i18n/useLanguage";
import styles from "./CopyCommand.module.css";
import { useCopyCommand } from "./useCopyCommand";

const startupCommand = "npx @loop-harness/loop web";

export const CopyCommand = () => {
  const { t } = useLanguage();
  const { codeRef, feedback, copy } = useCopyCommand(startupCommand);
  const feedbackId = useId();
  return (
    <div className={styles.hero}>
      <div className={styles.command} data-pointer-clear>
        <span className={styles.prompt} aria-hidden="true">
          $
        </span>
        <code ref={codeRef}>{startupCommand}</code>
        <button
          type="button"
          aria-label={t("copyLabel")}
          aria-describedby={feedbackId}
          onClick={copy}
          data-copied={feedback === "copied"}
        >
          {t(feedback === "copied" ? "copySuccess" : "copy")}
        </button>
      </div>
      <p
        className={styles["hero-feedback"]}
        id={feedbackId}
        role="status"
        aria-live="polite"
        data-pointer-clear
      >
        {feedback ? t(feedback) : ""}
      </p>
    </div>
  );
};
