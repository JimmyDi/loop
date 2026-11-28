import { useMemo } from "react";

import type { SessionSnapshot } from "../../shared/protocol";
import { appendTimelineDraft, groupTimelineTurns } from "../components/chat/timeline-turns";
import type { TimelineTurn } from "../components/chat/timeline-turns";
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
  const checkpointIndex = checkpoint && checkpoint.historyMessageCount - offset;
  const breaks = useMemo(
    () => [
      ...(checkpointIndex === undefined ? [] : [checkpointIndex]),
      ...timings.flatMap((timing) =>
        timing.messageStartIndex === undefined ? [] : [timing.messageStartIndex],
      ),
    ],
    [checkpointIndex, timings],
  );
  const completedTurns = useMemo(() => groupTimelineTurns(completed, breaks), [completed, breaks]);
  const appendDraft = draftIndex !== undefined && draftIndex >= completed.length;
  const turns = useMemo(() => {
    if (!draft || draftIndex === undefined || draftIndex < 0) return completedTurns;
    if (appendDraft) {
      return appendTimelineDraft(
        completedTurns,
        { index: draftIndex, message: draft },
        userMessageIndex === -1 ? undefined : userMessageIndex,
        breaks.includes(draftIndex),
      );
    }
    const messages = [...completed];
    messages[draftIndex] = draft;
    return groupTimelineTurns(messages, breaks);
  }, [completed, completedTurns, draft, draftIndex, appendDraft, userMessageIndex, breaks]);
  const resolveTiming = useMemo(() => {
    const byUser = new Map<number, typeof timings>();
    for (const timing of timings) {
      const group = byUser.get(timing.userMessageIndex) ?? [];
      group.push(timing);
      byUser.set(timing.userMessageIndex, group);
    }
    return (turn: TimelineTurn) =>
      timingForTurn(
        byUser.get(turn.type === "user" ? turn.index : (turn.userMessageIndex ?? -1)),
        turn,
      );
  }, [timings]);
  const completedTimings = useMemo(
    () => completedTurns.map(resolveTiming),
    [completedTurns, resolveTiming],
  );
  const turnTimings = useMemo(() => {
    if (turns === completedTurns) return completedTimings;
    if (appendDraft) {
      return turns.length === completedTurns.length
        ? completedTimings
        : [...completedTimings, resolveTiming(turns.at(-1)!)];
    }
    return turns.map(resolveTiming);
  }, [turns, completedTurns, completedTimings, appendDraft, resolveTiming]);
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
    hasMessages: completed.length > 0 || (draftIndex !== undefined && draftIndex >= 0),
    userMessageIndex,
    draftIndex,
    checkpoint,
    turns,
    turnTimings,
    skillsByIndex,
  };
};
