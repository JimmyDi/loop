import { useTranslation } from "react-i18next";

import type { ToolView } from "../../../shared/protocol";
import { ToolActionIcon } from "./ToolActionIcon";
import { ToolCard } from "./ToolCard";
import { toolActionSummary } from "./tool-action-summary";
import { toolLabel } from "./tool-label";
import "./ToolGroup.css";

export const ToolGroup = ({
  tools,
  generating = false,
}: {
  tools: ToolView[];
  generating?: boolean;
}) => {
  const { t } = useTranslation();
  const active =
    generating || tools.some((tool) => tool.status === "running" || tool.status === "waiting");
  const current =
    (generating ? tools.at(-1) : tools.findLast((tool) => tool.status === "running")) ??
    tools.findLast((tool) => tool.status === "waiting") ??
    tools.at(-1);
  if (!current) return null;

  const latest = toolLabel(current, t);
  const label = active ? latest.text : toolActionSummary(tools, t);

  return (
    <details className="tool-group" data-active={active} aria-busy={active}>
      <summary className="tool-group-summary" title={label}>
        <ToolActionIcon action={active ? latest.action : toolLabel(tools[0]!, t).action} />
        <span className="tool-group-label">{label}</span>
        <svg className="tool-group-chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </summary>
      <div className="tool-group-calls">
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </details>
  );
};
