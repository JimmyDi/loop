import type { PromptTiming } from "../../../shared/protocol";
import type { TimelineTurn } from "./timeline-turns";

export const timingForTurn = (
  timings: readonly PromptTiming[] = [],
  turn: TimelineTurn,
): PromptTiming | undefined => {
  const userIndex = turn.type === "user" ? turn.index : turn.userMessageIndex;
  const candidates = timings.filter((timing) => timing.userMessageIndex === userIndex);
  if (turn.type === "user") return candidates.at(-1);
  return (
    candidates.find(
      (timing) =>
        timing.messageStartIndex !== undefined &&
        turn.index >= timing.messageStartIndex &&
        (timing.messageEndIndex === undefined || turn.index < timing.messageEndIndex),
    ) ?? candidates.find((timing) => timing.messageStartIndex === undefined)
  );
};
