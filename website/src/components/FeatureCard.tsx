import type { ReactNode } from "react";

import styles from "./FeatureCard.module.css";

export const FeatureCard = ({
  title,
  description,
  children,
  details,
  copyClassName,
}: {
  title: ReactNode;
  description: string;
  children: ReactNode;
  details?: ReactNode;
  copyClassName?: string;
}) => (
  <article className={styles.feature}>
    <div className={[styles["feature-copy"], copyClassName].filter(Boolean).join(" ")}>
      <h3>{title}</h3>
      <p>{description}</p>
      {details}
    </div>
    <div className={styles["feature-media"]}>{children}</div>
  </article>
);
