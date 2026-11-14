import { Fragment, lazy, Suspense } from "react";

import type { RefObject } from "react";
import type { SessionSnapshot } from "../../../shared/protocol";
import type { useTimelineProjection } from "../../hooks/useTimelineProjection";
import { VirtualList } from "./VirtualList";
import type { VirtualRow } from "./VirtualList";
import "./TimelineMessages.css";
import { UserMessage } from "./UserMessage";
import { AssistantTurn } from "./AssistantTurn";
import { PromptDuration } from "./PromptDuration";
import { CompactionStatus } from "./CompactionStatus";
import { projectAssistantTurn } from "./timeline-turns";
import { plansForTimelineEntry } from "./timeline-plans";

const SessionPlans = lazy(() =>
  import("./SessionPlans").then((module) => ({ default: module.SessionPlans })),
);

export const TimelineMessages = ({
  snapshot,
  projection,
  start,
  userMessageRef,
  viewport,
  target,
  onTarget,
}: {
  snapshot: SessionSnapshot;
  projection: ReturnType<typeof useTimelineProjection>;
  start: number;
  userMessageRef: RefObject<HTMLElement | null>;
  viewport: RefObject<HTMLDivElement | null>;
  target?: { key: string; request: number };
  onTarget: () => void;
}) => {
  const { offset, userMessageIndex, checkpoint, turns, turnTimings, skillsByIndex, draftIndex } =
    projection;
  const compactedPosition = checkpoint
    ? turns.findLastIndex((turn) => turn.index + offset < checkpoint.historyMessageCount)
    : -1;
  const rows: VirtualRow[] = [];
  turns.slice(start).forEach((turn, visiblePosition) => {
    const position = start + visiblePosition;
    const timing = turnTimings[position];
    const neighborPosition = position + (timing?.stopped ? -1 : 1);
    const assistantTiming =
      turns[neighborPosition]?.type === "assistant" && turnTimings[neighborPosition] === timing
        ? undefined
        : timing;
    const key = `${snapshot.sessionId}:${turn.index + offset}`;

    if (turn.type === "user") {
      rows.push({
        key,
        render: () => (
          <Fragment key={key}>
            <UserMessage
              message={turn.message}
              skills={skillsByIndex.get(turn.index)}
              workspaceId={snapshot.workspaceId ?? undefined}
              ref={turn.index === userMessageIndex ? userMessageRef : undefined}
            />

            {snapshot.operation === "prompt" &&
              turn.index === userMessageIndex &&
              timing &&
              timing.finishedAt === undefined && <PromptDuration timing={timing} />}
            {timing?.finishedAt !== undefined && turns[position + 1]?.type !== "assistant" && (
              <PromptDuration timing={timing} />
            )}
            {position === compactedPosition && <CompactionStatus key={checkpoint?.id} />}
          </Fragment>
        ),
      });
      return;
    }

    const entries = projectAssistantTurn(turn.messages);
    for (const entry of entries) {
      const plans = plansForTimelineEntry(
        entry,
        turn.messages,
        snapshot.state.planning?.plans ?? [],
      );
      rows.push({
        key: key + ":" + (entry.index + offset),
        render: () => (
          <Fragment key={key}>
            <AssistantTurn
              selectedIndex={entry.index}
              projectedEntries={entries}
              offset={offset}
              messages={turn.messages}
              tools={snapshot.tools}
              timing={assistantTiming}
              draftIndex={draftIndex}
              running={snapshot.operation === "prompt" && turn === turns.at(-1)}
            />
            {!!plans.length && (
              <Suspense fallback={null}>
                <SessionPlans plans={plans} />
              </Suspense>
            )}
            {position === compactedPosition && entry === entries.at(-1) && (
              <CompactionStatus key={checkpoint?.id} />
            )}
          </Fragment>
        ),
      });
    }
  });

  const pinned = rows.flatMap((row, index) =>
    row.key === snapshot.sessionId + ":" + (userMessageIndex + offset) ? [index] : [],
  );
  return (
    <VirtualList
      key={snapshot.sessionId + ":" + snapshot.streamId}
      rows={rows}
      viewport={viewport}
      pinned={pinned}
      target={target}
      onTarget={onTarget}
    />
  );
};
