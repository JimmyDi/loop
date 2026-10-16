import { tokenizeCode } from "./code-tokens";
import type { CodeLanguage } from "./code-tokens";
import styles from "./CodeSnippet.module.css";

export const CodeSnippet = ({ source, language }: { source: string; language: CodeLanguage }) => (
  <code className={styles.code} data-language={language}>
    {tokenizeCode(source, language).map((token) => (
      <span className={styles[token.kind]} key={token.offset}>
        {token.text}
      </span>
    ))}
  </code>
);
