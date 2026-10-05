import type {
  DraftPhase,
  SessionRunTiming,
  SessionState,
  ToolView,
} from "../../../shared/protocol";
import { AssistantMessage } from "./AssistantMessage";
import { RunActivityCard } from "./RunActivityCard";
import { activityStatus, executionStatus } from "./activity-status";
import { projectAssistantTurn } from "./timeline-turns";
import type { TurnMessage } from "./timeline-turns";

export const AssistantTurn = ({
  messages,
  tools,
  draftIndex,
  draftPhase,
  running,
  title,
  outcome,
  timing,
}: {
  messages: TurnMessage[];
  tools: Record<string, ToolView>;
  draftIndex?: number;
  draftPhase?: DraftPhase;
  running: boolean;
  title: string;
  outcome?: SessionState["outcome"];
  timing?: SessionRunTiming;
}) => {
  const { activity, answer } = projectAssistantTurn(messages, draftIndex);

  return (
    <>
      {activity.length > 0 && (
        <RunActivityCard
          entries={activity}
          tools={tools}
          draftIndex={draftIndex}
          status={activityStatus(messages, running, outcome)}
          executionStatus={executionStatus(messages, tools, running, outcome, draftPhase)}
          title={title}
          timing={timing}
        />
      )}
      {answer && (
        <AssistantMessage
          key={answer.index}
          message={answer.message}
          tools={tools}
          streaming={running || answer.index === draftIndex}
        />
      )}
    </>
  );
};
