import { useTranslation } from "react-i18next";

import type { ToolView } from "../../../shared/protocol";
import { messageText } from "../../../shared/message-text";
import { CopyButton } from "../ui/CopyButton";
import "./ToolCard.css";

export const ToolCard = ({ tool }: { tool: ToolView }) => {
  const { t } = useTranslation();
  const output = tool.result ? messageText(tool.result) : "";

  return (
    <details className="tool-card" data-status={tool.status}>
      <summary>
        <code>{tool.name}</code>
        <span>{t(tool.status)}</span>
      </summary>
      <div className="tool-content">
        <strong>{t("parameters")}</strong>
        <pre>{JSON.stringify(tool.args ?? {}, null, 2)}</pre>
        {tool.result && (
          <>
            <strong>{t("result")}</strong>
            <pre>{output}</pre>
            <CopyButton text={output} />
          </>
        )}
      </div>
    </details>
  );
};
