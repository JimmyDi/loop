import { useTranslation } from "react-i18next";

import type { ToolView } from "../../../shared/protocol";
import { messageText } from "../../../shared/message-text";
import { useToolStatus } from "../../hooks/useToolStatus";
import { ActivityStatusIcon } from "./ActivityStatusIcon";
import "./ToolCard.css";

export const ToolCard = ({ tool }: { tool: ToolView }) => {
  const { t } = useTranslation();
  const output = tool.result ? messageText(tool.result) : "";
  const iconStatus = useToolStatus(tool.id, tool.status);

  return (
    <details className="tool-card" data-status={tool.status}>
      <summary>
        <span>{t("usedTool")}</span>
        <code>{tool.name}</code>
        <ActivityStatusIcon status={iconStatus} labelStatus={tool.status} />
      </summary>
      <div className="tool-content">
        <div className="tool-value">
          <strong>{t("parameters")}</strong>
          <pre>{JSON.stringify(tool.args ?? {}, null, 2)}</pre>
        </div>
        {tool.result && (
          <div className="tool-value">
            <strong>{t("result")}</strong>
            <pre>{output}</pre>
          </div>
        )}
      </div>
    </details>
  );
};
