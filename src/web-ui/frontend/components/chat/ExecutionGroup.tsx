import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { ToolView } from "../../../shared/protocol";
import { AssistantContent } from "./AssistantContent";
import { ActivityStatusIcon } from "./ActivityStatusIcon";
import type { ActivityStatus } from "./activity-status";
import type { TurnMessage } from "./timeline-turns";
import { ToolCard } from "./ToolCard";
import "./ExecutionGroup.css";

export const ExecutionGroup = ({
  entries,
  tools,
  draftIndex,
  status,
  title,
}: {
  entries: TurnMessage[];
  tools: Record<string, ToolView>;
  draftIndex?: number;
  status: ActivityStatus;
  title: string;
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  return (
    <div className="execution-group" data-status={status}>
      <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary>
          <ActivityStatusIcon status={status} />
          <strong>{title || t("workingOnRequest")}</strong>
          <span className="group-chevron" aria-hidden="true">
            ›
          </span>
        </summary>
        <div className="execution-group-body">
          {entries.map(({ index, message }) => (
            <div className="activity-step" key={index}>
              {message.role === "assistant" ? (
                <AssistantContent
                  message={message}
                  tools={tools}
                  streaming={index === draftIndex}
                />
              ) : (
                tools[message.toolCallId] && <ToolCard tool={tools[message.toolCallId]!} />
              )}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
};
