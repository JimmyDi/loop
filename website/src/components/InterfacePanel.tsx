import { useLanguage } from "../i18n/useLanguage";
import { CodeSnippet } from "./CodeSnippet";
import { ExternalLink } from "./ExternalLink";
import type { InterfaceOption } from "./interface-options";
import styles from "./InterfacePanel.module.css";

export const InterfacePanel = ({
  option,
  hidden,
}: {
  option: InterfaceOption;
  hidden: boolean;
}) => {
  const { t } = useLanguage();
  const language = option.id === "sdk" ? "typescript" : "bash";
  const source = [t(option.comment), option.command].join("\n");
  return (
    <div
      className={styles["interface-panel"]}
      data-language={language}
      id={"panel-" + option.id}
      hidden={hidden}
    >
      <pre>
        <CodeSnippet source={source} language={language} />
      </pre>
      {option.docs && <ExternalLink href={option.docs.href}>{t(option.docs.label)}</ExternalLink>}
    </div>
  );
};
