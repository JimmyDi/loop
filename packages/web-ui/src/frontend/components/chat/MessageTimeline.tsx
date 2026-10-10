import { Fragment } from "react";
import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../../shared/protocol";
import { useAutoScroll } from "../../hooks/useAutoScroll";
import { useReadReceipt } from "../../hooks/useReadReceipt";
import { AssistantTurn } from "./AssistantTurn";
import { groupTimelineTurns } from "./timeline-turns";
import { UserMessage } from "./UserMessage";
import { LoopingIndicator } from "./LoopingIndicator";
import { PromptDuration } from "./PromptDuration";
import { JumpToLatestButton } from "./JumpToLatestButton";
import { CompactionStatus } from "./CompactionStatus";
import "./MessageTimeline.css";

export const MessageTimeline = ({
  snapshot,
  connected,
}: {
  snapshot: SessionSnapshot;
  connected: boolean;
}) => {
  const { t } = useTranslation();
  const userMessageIndex = snapshot.state.messages.reduce(
    (latest, message, index) => (message.role === "user" ? index : latest),
    -1,
  );
  const scroll = useAutoScroll({
    sessionId: snapshot.sessionId,
    userMessageIndex,
    running: snapshot.operation === "prompt",
    activityKey: snapshot.operation === "compact" ? snapshot.compactionStartedAt : undefined,
    revision: snapshot,
  });
  const automatic = snapshot.state.activeCompaction;
  const compacting = snapshot.operation === "compact" || !!automatic;
  const compactStartedAt = automatic?.startedAt ?? snapshot.compactionStartedAt;
  const looping = connected && snapshot.operation === "prompt" && !compacting;
  useReadReceipt(snapshot, connected, scroll.ref, scroll.endRef);
  const messages = [...snapshot.state.messages];
  const draftIndex = snapshot.state.draft ? (snapshot.draftIndex ?? messages.length) : undefined;

  if (snapshot.state.draft && draftIndex !== undefined) messages[draftIndex] = snapshot.state.draft;

  const checkpoint = snapshot.state.hasPendingSave ? undefined : snapshot.state.compaction;
  const turns = groupTimelineTurns(messages, checkpoint?.historyMessageCount);
  const compactedPosition = checkpoint
    ? turns.findLastIndex((turn) => turn.index < checkpoint.historyMessageCount)
    : -1;

  return (
    <div className="timeline-region">
      <div
        className="message-timeline"
        ref={scroll.ref}
        onScroll={scroll.onScroll}
        role="log"
        aria-live="off"
      >
        <div className="timeline-content" ref={scroll.contentRef}>
          {!messages.length && !looping && <p className="timeline-empty">{t("emptySession")}</p>}
          {turns.map((turn, position) => {
            const timing = snapshot.state.promptTimings?.find(
              (candidate) =>
                candidate.userMessageIndex ===
                (turn.type === "user" ? turn.index : turn.userMessageIndex),
            );
            const key = `${snapshot.sessionId}:${turn.index}`;

            if (turn.type === "user") {
              const skills =
                snapshot.state.skillLoads?.find(
                  (row) =>
                    row.userTurn ===
                    messages.slice(0, turn.index).filter((message) => message.role === "user")
                      .length,
                )?.skills ?? [];
              return (
                <Fragment key={key}>
                  <UserMessage
                    message={turn.message}
                    skills={skills}
                    workspaceId={snapshot.workspaceId}
                    ref={turn.index === userMessageIndex ? scroll.userMessageRef : undefined}
                  />
                  {snapshot.operation === "prompt" &&
                    turn.index === userMessageIndex &&
                    timing &&
                    timing.finishedAt === undefined && <PromptDuration timing={timing} />}
                  {timing?.finishedAt !== undefined &&
                    turns[position + 1]?.type !== "assistant" && <PromptDuration timing={timing} />}
                  {position === compactedPosition && <CompactionStatus key={checkpoint?.id} />}
                </Fragment>
              );
            }

            return (
              <Fragment key={key}>
                <AssistantTurn
                  messages={turn.messages}
                  tools={snapshot.tools}
                  timing={turns[position + 1]?.type === "assistant" ? undefined : timing}
                  draftIndex={draftIndex}
                  running={snapshot.operation === "prompt" && turn === turns.at(-1)}
                />
                {position === compactedPosition && <CompactionStatus key={checkpoint?.id} />}
              </Fragment>
            );
          })}
          {looping && <LoopingIndicator />}
          {compacting && (
            <CompactionStatus
              key={`${snapshot.sessionId}:${compactStartedAt}`}
              running
              connected={connected}
              startedAt={compactStartedAt}
            />
          )}
          <div ref={scroll.endRef} aria-hidden="true" />
        </div>
      </div>
      {!scroll.atBottom && <JumpToLatestButton running={looping} onClick={scroll.jump} />}
    </div>
  );
};
