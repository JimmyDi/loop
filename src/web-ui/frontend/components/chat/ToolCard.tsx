import { useTranslation } from "react-i18next";

import type { ToolView } from "../../../shared/protocol";
import { messageText } from "../../../shared/message-text";
import { useToolStatus } from "../../hooks/useToolStatus";
import { ActivityStatusIcon } from "./ActivityStatusIcon";
import { ToolActionIcon } from "./ToolActionIcon";
import "./ToolCard.css";

export const ToolCard = ({ tool }: { tool: ToolView }) => {
  const { t } = useTranslation();
  const output = tool.result ? messageText(tool.result) : "";
  const iconStatus = useToolStatus(tool.id, tool.status);
  const action =
    tool.name === "read" || tool.name === "write" || tool.name === "edit" || tool.name === "bash"
      ? tool.name
      : "other";
  const state = tool.status === "running" || tool.status === "success" ? tool.status : "idle";
  const argument = tool.args?.[action === "bash" ? "command" : "path"];
  const target =
    action === "other"
      ? tool.name
      : typeof argument === "string" && argument.trim()
        ? argument.trim()
        : t(`toolLabels.${action}.target`);
  const label = action === "bash" ? "Bash" : t(`toolLabels.${action}.${state}`);
  const separator = action === "bash" ? " · " : " ";

  return (
    <details className="tool-card" data-status={tool.status}>
      <summary>
        <ToolActionIcon action={action} />
        <span className="tool-card-label" title={`${label}${separator}${target}`}>
          {label}
          {separator}
          <span className="tool-card-target">{target}</span>
        </span>
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
