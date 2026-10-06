import type { Message } from "@earendil-works/pi-ai";

/** Prompt wall time, independent of model content phases and presentation. */
export type PromptTiming = {
  userMessageIndex: number;
  startedAt: number;
  finishedAt?: number;
};

export const validatePromptTimings = (value: unknown, messages: readonly Message[]): void => {
  if (value === undefined) return;
  if (!Array.isArray(value)) throw new Error("Invalid prompt timings");

  let previous = -1;
  for (const timing of value) {
    if (
      !timing ||
      !Number.isSafeInteger(timing.userMessageIndex) ||
      timing.userMessageIndex <= previous ||
      messages[timing.userMessageIndex]?.role !== "user" ||
      !Number.isSafeInteger(timing.startedAt) ||
      timing.startedAt < 0 ||
      !Number.isSafeInteger(timing.finishedAt) ||
      timing.finishedAt < timing.startedAt
    )
      throw new Error("Invalid prompt timings");

    previous = timing.userMessageIndex;
  }
};
