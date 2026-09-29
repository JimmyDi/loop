import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { SessionRunTiming, ToolView } from "../../../shared/protocol";
import { activityFailures } from "./activity-status";
import type { ActivityStatus } from "./activity-status";
import { ExecutionGroup } from "./ExecutionGroup";
import { RunDuration } from "./RunDuration";
import type { TurnMessage } from "./timeline-turns";
import "./RunActivityCard.css";

export const RunActivityCard = ({
  entries,
  tools,
  draftIndex,
  status,
  executionStatus = status,
  title,
  timing,
}: {
  entries: TurnMessage[];
  tools: Record<string, ToolView>;
  draftIndex?: number;
  status: ActivityStatus;
  executionStatus?: ActivityStatus;
  title: string;
  timing?: SessionRunTiming;
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(() => status === "running");
  const failures = activityFailures(entries, tools);

  return (
    <section className="run-activity-card" aria-label={t("reasoning")} data-status={status}>
      <details
        className="run-activity-disclosure"
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary>
          <RunDuration timing={timing} status={status} />
          <span className="run-activity-chevron" aria-hidden="true">
            ›
          </span>
          {failures > 0 && (
            <span className="run-activity-errors">{t("toolFailures", { count: failures })}</span>
          )}
        </summary>
        <div className="run-activity-content">
          <ExecutionGroup
            entries={entries}
            tools={tools}
            draftIndex={draftIndex}
            status={executionStatus}
            title={title}
          />
        </div>
      </details>
    </section>
  );
};
