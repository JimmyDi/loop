import type { Message } from "@earendil-works/pi-ai";

export type SessionRunTiming = {
  userMessageIndex: number;
  startedAt: number;
  finishedAt?: number;
};

export const validateRunTimings = (value: unknown, messages: readonly Message[]): void => {
  if (value === undefined) return;
  if (!Array.isArray(value)) throw new Error("Invalid session run timings");

  const indices = new Set<number>();

  for (const timing of value) {
    if (
      !timing ||
      !Number.isSafeInteger(timing.userMessageIndex) ||
      timing.userMessageIndex < 0 ||
      messages[timing.userMessageIndex]?.role !== "user" ||
      indices.has(timing.userMessageIndex) ||
      !Number.isSafeInteger(timing.startedAt) ||
      timing.startedAt < 0 ||
      !Number.isSafeInteger(timing.finishedAt) ||
      timing.finishedAt < timing.startedAt
    )
      throw new Error("Invalid session run timings");

    indices.add(timing.userMessageIndex);
  }
};
