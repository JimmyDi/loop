import { useTranslation } from "react-i18next";

import type { ToolView } from "../../../shared/protocol";
import { messageText } from "../../../shared/message-text";
import { useToolStatus } from "../../hooks/useToolStatus";
import { ToolStatusIcon } from "./ToolStatusIcon";
import { ToolActionIcon } from "./ToolActionIcon";
import { toolLabel } from "./tool-label";
import "./ToolCard.css";

export const ToolCard = ({ tool }: { tool: ToolView }) => {
  const { t } = useTranslation();
  const output = tool.result ? messageText(tool.result) : "";
  const iconStatus = useToolStatus(tool.id, tool.status);
  const { action, label, target, text } = toolLabel(tool, t);

  return (
    <details className="tool-card" data-status={tool.status}>
      <summary>
        <ToolActionIcon action={action} />
        <span className="tool-card-label" title={text}>
          {label} <span className="tool-card-target">{target}</span>
        </span>
        <ToolStatusIcon status={iconStatus} labelStatus={tool.status} />
        <svg className="tool-card-chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9 6 6 6-6 6" />
        </svg>
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
