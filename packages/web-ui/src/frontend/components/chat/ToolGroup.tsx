import { useTranslation } from "react-i18next";

import type { ToolView } from "../../../shared/protocol";
import { ToolCard } from "./ToolCard";
import { toolActionSummary } from "./tool-action-summary";
import "./ToolGroup.css";

export const ToolGroup = ({ tools, hasPreamble }: { tools: ToolView[]; hasPreamble: boolean }) => {
  const { t } = useTranslation();
  const summary = hasPreamble ? "" : toolActionSummary(tools, t);

  return (
    <div className="tool-group">
      {summary && <p className="tool-group-preamble">{summary}</p>}
      <div className="tool-group-calls">
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </div>
  );
};
