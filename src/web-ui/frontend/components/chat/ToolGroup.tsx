import { useTranslation } from "react-i18next";

import type { ToolView } from "../../../shared/protocol";
import { ToolCard } from "./ToolCard";
import "./ToolGroup.css";

export const ToolGroup = ({ tools, hasPreamble }: { tools: ToolView[]; hasPreamble: boolean }) => {
  const { t } = useTranslation();
  const name = tools.every((tool) => tool.name === tools[0]?.name) ? tools[0]?.name : undefined;
  const action =
    name === "read" || name === "write" || name === "edit" || name === "bash" ? name : "other";

  return (
    <div className="tool-group">
      {!hasPreamble && <p className="tool-group-preamble">{t(`toolActions.${action}`)}</p>}
      <div className="tool-group-calls">
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </div>
  );
};
