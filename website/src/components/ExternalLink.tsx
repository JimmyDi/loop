import type { ReactNode } from "react";

import styles from "./ExternalLink.module.css";

export const ExternalLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className={styles.plain}>
    {children}
    <span aria-hidden="true">↗</span>
  </a>
);
