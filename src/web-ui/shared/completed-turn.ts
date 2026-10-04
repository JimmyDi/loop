import type { SessionRunTiming } from "./protocol";

/** Stable across title changes, saves, reconnects and server restarts. */
export const latestCompletedTurn = (
  timings: readonly SessionRunTiming[] | undefined,
  messageCount: number,
): number | undefined =>
  timings?.reduce<number | undefined>(
    (latest, timing, index) =>
      timing.finishedAt !== undefined &&
      (timings[index + 1]?.userMessageIndex ?? messageCount) > timing.userMessageIndex + 1
        ? Math.max(latest ?? -1, timing.userMessageIndex)
        : latest,
    undefined,
  );
