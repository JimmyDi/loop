import type { Message } from "@earendil-works/pi-ai";

/** Prompt wall time, independent of model content phases and presentation. */
export type PromptTiming = {
  id?: string;
  userMessageIndex: number;
  messageStartIndex?: number;
  messageEndIndex?: number;
  startedAt: number;
  finishedAt?: number;
  stopped?: boolean;
};

export const validatePromptTimings = (value: unknown, messages: readonly Message[]): void => {
  if (value === undefined) return;
  if (!Array.isArray(value)) throw new Error("Invalid prompt timings");

  let previous = -1;
  let previousEnd = -1;
  const ids = new Set<string>();
  for (const timing of value) {
    if (
      !timing ||
      !Number.isSafeInteger(timing.userMessageIndex) ||
      timing.userMessageIndex < previous ||
      (timing.userMessageIndex === previous && timing.messageStartIndex === undefined) ||
      messages[timing.userMessageIndex]?.role !== "user" ||
      !Number.isSafeInteger(timing.startedAt) ||
      timing.startedAt < 0 ||
      !Number.isSafeInteger(timing.finishedAt) ||
      timing.finishedAt < timing.startedAt
    )
      throw new Error("Invalid prompt timings");

    if (timing.messageStartIndex !== undefined) {
      if (
        typeof timing.id !== "string" ||
        !timing.id ||
        ids.has(timing.id) ||
        !Number.isSafeInteger(timing.messageStartIndex) ||
        timing.messageStartIndex <= timing.userMessageIndex ||
        timing.messageStartIndex < previousEnd ||
        !Number.isSafeInteger(timing.messageEndIndex) ||
        timing.messageEndIndex < timing.messageStartIndex ||
        timing.messageEndIndex > messages.length ||
        (timing.stopped !== undefined && typeof timing.stopped !== "boolean")
      )
        throw new Error("Invalid prompt timings");
      ids.add(timing.id);
      previousEnd = timing.messageEndIndex;
    } else if (
      timing.id !== undefined ||
      timing.messageEndIndex !== undefined ||
      timing.stopped !== undefined
    ) {
      throw new Error("Invalid prompt timings");
    }

    previous = timing.userMessageIndex;
  }
};
