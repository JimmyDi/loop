import { Fragment, useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../../shared/protocol";
import { useAutoScroll } from "../../hooks/useAutoScroll";
import { useReadReceipt } from "../../hooks/useReadReceipt";
import { useTimelineHistory } from "../../hooks/useTimelineHistory";
import { HistoryMediaContext } from "../../lib/history-media-context";
import { MessageImageContext } from "../../lib/message-image-context";
import { AssistantTurn } from "./AssistantTurn";
import { UserMessage } from "./UserMessage";
import { LoopingIndicator } from "./LoopingIndicator";
import { PromptDuration } from "./PromptDuration";
import { JumpToLatestButton } from "./JumpToLatestButton";
import { CompactionStatus } from "./CompactionStatus";
import { useTimelineProjection } from "../../hooks/useTimelineProjection";
import { TimelineDisclosures } from "../../lib/timeline-disclosures";
import { VirtualList } from "./VirtualList";
import type { VirtualRow } from "./VirtualList";
import { projectAssistantTurn } from "./timeline-turns";
import "./MessageTimeline.css";

export const MessageTimeline = ({
  snapshot,
  connected,
}: {
  snapshot: SessionSnapshot;
  connected: boolean;
}) => {
  const { t } = useTranslation();
  const {
    offset,
    messages,
    userMessageIndex,
    draftIndex,
    checkpoint,
    turns,
    turnTimings,
    skillsByIndex,
  } = useTimelineProjection(snapshot);
  const disclosures = useMemo(
    () => new Map<string, boolean>(),
    [snapshot.sessionId, snapshot.streamId],
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

  const rows: VirtualRow[] = [];
  turns.slice(history.start).forEach((turn, visiblePosition) => {
    const position = history.start + visiblePosition;
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
              ref={turn.index === userMessageIndex ? scroll.userMessageRef : undefined}
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
    for (const entry of entries)
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
            {position === compactedPosition && entry === entries.at(-1) && (
              <CompactionStatus key={checkpoint?.id} />
            )}
          </Fragment>
        ),
      });
  });

  const pinned = rows.flatMap((row, index) =>
    row.key === snapshot.sessionId + ":" + (userMessageIndex + offset) ? [index] : [],
  );
  return (
    <TimelineDisclosures value={disclosures}>
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
                <VirtualList
                  key={snapshot.sessionId + ":" + snapshot.streamId}
                  rows={rows}
                  viewport={scroll.ref}
                  pinned={pinned}
                />
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
    </TimelineDisclosures>
  );
};
