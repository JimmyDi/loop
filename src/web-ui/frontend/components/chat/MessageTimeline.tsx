import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../../shared/protocol";
import { useAutoScroll } from "../../hooks/useAutoScroll";
import { ActionButton } from "../ui/ActionButton";
import { AssistantTurn } from "./AssistantTurn";
import { groupTimelineTurns } from "./timeline-turns";
import { UserMessage } from "./UserMessage";
import { LoopingIndicator } from "./LoopingIndicator";
import "./MessageTimeline.css";

export const MessageTimeline = ({
  snapshot,
  connected,
}: {
  snapshot: SessionSnapshot;
  connected: boolean;
}) => {
  const { t } = useTranslation();
  const scroll = useAutoScroll(snapshot);
  const looping = connected && snapshot.operation === "prompt";
  const messages = [...snapshot.state.messages];
  const draftIndex = snapshot.state.draft ? (snapshot.draftIndex ?? messages.length) : undefined;

  if (snapshot.state.draft && draftIndex !== undefined) messages[draftIndex] = snapshot.state.draft;

  const turns = groupTimelineTurns(messages);

  return (
    <div className="timeline-region">
      <div
        className="message-timeline"
        ref={scroll.ref}
        onScroll={scroll.onScroll}
        role="log"
        aria-live="off"
      >
        <div className="timeline-content">
          {!messages.length && !looping && <p className="timeline-empty">{t("emptySession")}</p>}
          {turns.map((turn) => {
            const key = `${snapshot.sessionId}:${turn.index}`;

            if (turn.type === "user") return <UserMessage key={key} message={turn.message} />;

            return (
              <AssistantTurn
                key={key}
                messages={turn.messages}
                tools={snapshot.tools}
                draftIndex={draftIndex}
                draftPhase={turn === turns.at(-1) ? snapshot.draftPhase : undefined}
                running={snapshot.operation === "prompt" && turn === turns.at(-1)}
                outcome={turn === turns.at(-1) ? snapshot.state.outcome : undefined}
                title={turn.title}
                timing={snapshot.state.runTimings?.find(
                  (timing) => timing.userMessageIndex === turn.userMessageIndex,
                )}
              />
            );
          })}
          {looping && <LoopingIndicator />}
        </div>
      </div>
      {!scroll.atBottom && (
        <ActionButton className="jump-latest" onClick={scroll.jump}>
          {t("scrollBottom")}
        </ActionButton>
      )}
    </div>
  );
};
