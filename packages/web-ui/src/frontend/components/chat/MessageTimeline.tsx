import { useCallback, useMemo, useRef } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../../shared/protocol";
import { useAutoScroll } from "../../hooks/useAutoScroll";
import { useReadReceipt } from "../../hooks/useReadReceipt";
import { useTimelineHistory } from "../../hooks/useTimelineHistory";
import { HistoryMediaContext } from "../../lib/history-media-context";
import { MessageImageContext } from "../../lib/message-image-context";
import { LoopingIndicator } from "./LoopingIndicator";
import { JumpToLatestButton } from "./JumpToLatestButton";
import { CompactionStatus } from "./CompactionStatus";
import { useTimelineProjection } from "../../hooks/useTimelineProjection";
import { TimelineDisclosures } from "../../lib/timeline-disclosures";
import { MessageNavigation } from "./MessageNavigation";
import { useTimelineWindow } from "../../hooks/useTimelineWindow";
import { TimelineMessages } from "./TimelineMessages";
import "./MessageTimeline.css";

export const MessageTimeline = ({
  snapshot: live,
  connected,
}: {
  snapshot: SessionSnapshot;
  connected: boolean;
}) => {
  const { t } = useTranslation();
  const viewport = useRef<HTMLDivElement>(null);
  const window = useTimelineWindow(live, viewport);
  const snapshot = window.snapshot;
  const projection = useTimelineProjection(snapshot);
  const { messages, turns } = projection;
  const disclosures = useMemo(
    () => new Map<string, boolean>(),
    [snapshot.sessionId, snapshot.streamId],
  );
  const scroll = useAutoScroll({
    sessionId: snapshot.sessionId,
    userMessageIndex:
      (live.history?.start ?? 0) +
      live.state.messages.findLastIndex((message) => message.role === "user"),
    running: snapshot.operation === "prompt",
    activityKey: snapshot.operation === "compact" ? snapshot.compactionStartedAt : undefined,
    revision: snapshot,
    navigating: window.navigating,
  });
  const automatic = snapshot.state.activeCompaction;
  const bindViewport = useCallback(
    (node: HTMLDivElement | null) => {
      scroll.ref.current = node;
      viewport.current = node;
    },
    [scroll.ref],
  );
  const compacting = snapshot.operation === "compact" || !!automatic;
  const compactStartedAt = automatic?.startedAt ?? snapshot.compactionStartedAt;
  const looping = connected && snapshot.operation === "prompt" && !compacting;
  useReadReceipt(live, connected && !window.detached, scroll.ref, scroll.endRef);
  const history = useTimelineHistory(
    snapshot.sessionId,
    turns,
    scroll.ref,
    scroll.releaseAnchor,
    snapshot,
    window.prepend,
  );

  return (
    <TimelineDisclosures value={disclosures}>
      <HistoryMediaContext value={history.loading}>
        <MessageImageContext value={snapshot.sessionId}>
          <div className="timeline-region">
            <MessageNavigation
              key={snapshot.sessionId + ":" + snapshot.streamId}
              snapshot={live}
              viewport={scroll.ref}
              onSelect={(index) => {
                scroll.releaseAnchor();
                history.cancel();
                history.show(index);
                window.select(index);
              }}
            />
            {(history.loading || window.loading) && (
              <div className="timeline-history-loading" role="status">
                <span className="timeline-history-spinner" aria-hidden="true" />
                {t("loadingMoreMessages")}
              </div>
            )}
            <div
              className="message-timeline"
              ref={bindViewport}
              onScroll={() => {
                if (history.onScroll()) scroll.onScroll();
              }}
              onWheel={(event) => {
                if (!window.loading) history.onWheel(event);
                if (!history.loading && event.deltaY > 0) window.forward();
              }}
              onTouchStart={history.onTouchStart}
              onTouchMove={(event) => {
                if (!window.loading) history.onTouchMove(event);
                if (!history.loading) window.forward();
              }}
              role="log"
              aria-live="off"
            >
              <div className="timeline-content" ref={scroll.contentRef}>
                {(history.error || window.error) && (
                  <button type="button" onClick={window.error ? window.retry : history.retry}>
                    {t("retry")}
                  </button>
                )}
                {!messages.length && !looping && (
                  <p className="timeline-empty">{t("emptySession")}</p>
                )}
                <TimelineMessages
                  key={snapshot.sessionId + ":" + snapshot.streamId}
                  snapshot={snapshot}
                  projection={projection}
                  start={history.start}
                  userMessageRef={scroll.userMessageRef}
                  viewport={scroll.ref}
                  target={window.target}
                  onTarget={window.complete}
                />
                {looping && !window.detached && <LoopingIndicator />}
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
            {(window.detached || !scroll.atBottom) && (
              <JumpToLatestButton
                running={looping}
                onClick={() => {
                  history.cancel();
                  flushSync(window.latest);
                  scroll.jump();
                }}
              />
            )}
          </div>
        </MessageImageContext>
      </HistoryMediaContext>
    </TimelineDisclosures>
  );
};
