import { useMemo } from "react";

import type { SessionSnapshot } from "../../shared/protocol";
import { groupTimelineTurns } from "../components/chat/timeline-turns";
import { timingForTurn } from "../components/chat/timeline-timing";

export const useTimelineProjection = (snapshot: SessionSnapshot) => {
  const offset = snapshot.history?.start ?? 0;
  const completed = snapshot.state.messages;
  const draft = snapshot.state.draft;
  const userMessageIndex = useMemo(
    () => completed.findLastIndex((message) => message.role === "user"),
    [completed],
  );
  const draftIndex = draft
    ? (snapshot.draftIndex ?? offset + completed.length) - offset
    : undefined;
  const messages = useMemo(() => {
    if (!draft || draftIndex === undefined) return completed;
    const messages = [...completed];
    messages[draftIndex] = draft;
    return messages;
  }, [completed, draft, draftIndex]);
  const checkpoint = snapshot.state.hasPendingSave ? undefined : snapshot.state.compaction;
  const timings = useMemo(
    () =>
      (snapshot.state.promptTimings ?? []).map((timing) => ({
        ...timing,
        userMessageIndex: timing.userMessageIndex - offset,
        messageStartIndex:
          timing.messageStartIndex === undefined ? undefined : timing.messageStartIndex - offset,
        messageEndIndex:
          timing.messageEndIndex === undefined ? undefined : timing.messageEndIndex - offset,
      })),
    [snapshot.state.promptTimings, offset],
  );
  const turns = useMemo(
    () =>
      groupTimelineTurns(messages, [
        ...(checkpoint ? [checkpoint.historyMessageCount - offset] : []),
        ...timings.flatMap((timing) =>
          timing.messageStartIndex === undefined ? [] : [timing.messageStartIndex],
        ),
      ]),
    [messages, checkpoint, offset, timings],
  );
  const turnTimings = useMemo(() => {
    const byUser = new Map<number, typeof timings>();
    for (const timing of timings) {
      const group = byUser.get(timing.userMessageIndex) ?? [];
      group.push(timing);
      byUser.set(timing.userMessageIndex, group);
    }
    return turns.map((turn) =>
      timingForTurn(
        byUser.get(turn.type === "user" ? turn.index : (turn.userMessageIndex ?? -1)),
        turn,
      ),
    );
  }, [turns, timings]);
  const skillsByIndex = useMemo(() => {
    const loads = new Map(
      (snapshot.state.skillLoads ?? []).map((row) => [row.userTurn, row.skills]),
    );
    const result = new Map<
      number,
      NonNullable<typeof snapshot.state.skillLoads>[number]["skills"]
    >();
    let userTurn = snapshot.history?.userStart ?? 0;
    completed.forEach((message, index) => {
      if (message.role !== "user") return;
      const skills = loads.get(userTurn++);
      if (skills) result.set(index, skills);
    });
    return result;
  }, [completed, snapshot.state.skillLoads, snapshot.history?.userStart]);
  return {
    offset,
    messages,
    userMessageIndex,
    draftIndex,
    checkpoint,
    turns,
    turnTimings,
    skillsByIndex,
  };
};
