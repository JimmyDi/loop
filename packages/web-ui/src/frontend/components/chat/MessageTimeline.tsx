import { Fragment } from "react";
import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../../shared/protocol";
import { useAutoScroll } from "../../hooks/useAutoScroll";
import { useReadReceipt } from "../../hooks/useReadReceipt";
import { useTimelineHistory } from "../../hooks/useTimelineHistory";
import { HistoryMediaContext } from "../../lib/history-media-context";
import { MessageImageContext } from "../../lib/message-image-context";
import { AssistantTurn } from "./AssistantTurn";
import { groupTimelineTurns } from "./timeline-turns";
import { UserMessage } from "./UserMessage";
import { LoopingIndicator } from "./LoopingIndicator";
import { PromptDuration } from "./PromptDuration";
import { JumpToLatestButton } from "./JumpToLatestButton";
import { CompactionStatus } from "./CompactionStatus";
import { timingForTurn } from "./timeline-timing";
import "./MessageTimeline.css";

export const MessageTimeline = ({
  snapshot,
  connected,
}: {
  snapshot: SessionSnapshot;
  connected: boolean;
}) => {
  const { t } = useTranslation();
  const offset = snapshot.history?.start ?? 0;
  const userMessageIndex = snapshot.state.messages.reduce(
    (latest, message, index) => (message.role === "user" ? index : latest),
    -1,
  );
  const scroll = useAutoScroll({
    sessionId: snapshot.sessionId,
    userMessageIndex: userMessageIndex < 0 ? -1 : userMessageIndex + offset,
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
  const draftIndex = snapshot.state.draft
    ? (snapshot.draftIndex ?? offset + messages.length) - offset
    : undefined;

  if (snapshot.state.draft && draftIndex !== undefined) messages[draftIndex] = snapshot.state.draft;

  const checkpoint = snapshot.state.hasPendingSave ? undefined : snapshot.state.compaction;
  const timings = snapshot.state.promptTimings ?? [];
  const turns = groupTimelineTurns(messages, [
    ...(checkpoint ? [checkpoint.historyMessageCount - offset] : []),
    ...timings.flatMap((timing) =>
      timing.messageStartIndex === undefined ? [] : [timing.messageStartIndex - offset],
    ),
  ]);
  const compactedPosition = checkpoint
    ? turns.findLastIndex((turn) => turn.index + offset < checkpoint.historyMessageCount)
    : -1;
  const history = useTimelineHistory(
    snapshot.sessionId,
    turns,
    scroll.ref,
    scroll.releaseAnchor,
    snapshot,
  );

  return (
    <HistoryMediaContext value={history.loading}>
      <MessageImageContext value={snapshot.sessionId}>
        <div className="timeline-region">
          {history.loading && (
            <div className="timeline-history-loading" role="status">
              <span className="timeline-history-spinner" aria-hidden="true" />
              {t("loadingMoreMessages")}
            </div>
          )}
          <div
            className="message-timeline"
            ref={scroll.ref}
            onScroll={() => {
              if (history.onScroll()) scroll.onScroll();
            }}
            onWheel={history.onWheel}
            onTouchStart={history.onTouchStart}
            onTouchMove={history.onTouchMove}
            role="log"
            aria-live="off"
          >
            <div className="timeline-content" ref={scroll.contentRef}>
              {history.error && (
                <button type="button" onClick={history.retry}>
                  {t("retry")}
                </button>
              )}
              {!messages.length && !looping && (
                <p className="timeline-empty">{t("emptySession")}</p>
              )}
              {turns.slice(history.start).map((turn, visiblePosition) => {
                const position = history.start + visiblePosition;
                const localTimings = timings.map((timing) => ({
                  ...timing,
                  userMessageIndex: timing.userMessageIndex - offset,
                  messageStartIndex:
                    timing.messageStartIndex === undefined
                      ? undefined
                      : timing.messageStartIndex - offset,
                  messageEndIndex:
                    timing.messageEndIndex === undefined
                      ? undefined
                      : timing.messageEndIndex - offset,
                }));
                const timing = timingForTurn(localTimings, turn);
                const neighbor = turns[position + (timing?.stopped ? -1 : 1)];
                const assistantTiming =
                  neighbor?.type === "assistant" && timingForTurn(localTimings, neighbor) === timing
                    ? undefined
                    : timing;
                const key = `${snapshot.sessionId}:${turn.index + offset}`;

                if (turn.type === "user") {
                  const skills =
                    snapshot.state.skillLoads?.find(
                      (row) =>
                        row.userTurn ===
                        (snapshot.history?.userStart ?? 0) +
                          messages.slice(0, turn.index).filter((message) => message.role === "user")
                            .length,
                    )?.skills ?? [];
                  return (
                    <Fragment key={key}>
                      <UserMessage
                        message={turn.message}
                        skills={skills}
                        workspaceId={snapshot.workspaceId ?? undefined}
                        ref={turn.index === userMessageIndex ? scroll.userMessageRef : undefined}
                      />
                      {snapshot.operation === "prompt" &&
                        turn.index === userMessageIndex &&
                        timing &&
                        timing.finishedAt === undefined && <PromptDuration timing={timing} />}
                      {timing?.finishedAt !== undefined &&
                        turns[position + 1]?.type !== "assistant" && (
                          <PromptDuration timing={timing} />
                        )}
                      {position === compactedPosition && <CompactionStatus key={checkpoint?.id} />}
                    </Fragment>
                  );
                }

                return (
                  <Fragment key={key}>
                    <AssistantTurn
                      offset={offset}
                      messages={turn.messages}
                      tools={snapshot.tools}
                      timing={assistantTiming}
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
      </MessageImageContext>
    </HistoryMediaContext>
  );
};
