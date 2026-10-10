import type { Message, Usage } from "@earendil-works/pi-ai";

export type CompactionCheckpoint = {
  id: string;
  firstKeptMessageIndex: number;
  historyMessageCount: number;
  summary: string;
  timestamp: number;
  provider: string;
  model: string;
  usage: Usage;
};

export const validateCompactions = (value: unknown, messages: readonly Message[]): void => {
  if (value === undefined) return;
  if (!Array.isArray(value)) throw new Error("Invalid compaction checkpoints");
  let previous = 0;
  const ids = new Set<string>();
  for (const entry of value) {
    if (
      !entry ||
      typeof entry.id !== "string" ||
      !/^[a-f0-9-]{36}$/.test(entry.id) ||
      ids.has(entry.id) ||
      !Number.isSafeInteger(entry.firstKeptMessageIndex) ||
      entry.firstKeptMessageIndex <= previous ||
      !Number.isSafeInteger(entry.historyMessageCount) ||
      entry.historyMessageCount > messages.length ||
      entry.firstKeptMessageIndex >= entry.historyMessageCount ||
      messages[entry.firstKeptMessageIndex]?.role !== "user" ||
      typeof entry.summary !== "string" ||
      !entry.summary.trim() ||
      !Number.isSafeInteger(entry.timestamp) ||
      entry.timestamp < 0 ||
      typeof entry.provider !== "string" ||
      typeof entry.model !== "string" ||
      !entry.usage ||
      typeof entry.usage !== "object" ||
      ["input", "output", "cacheRead", "cacheWrite", "totalTokens"].some(
        (key) => !Number.isFinite(entry.usage[key]) || entry.usage[key] < 0,
      )
    )
      throw new Error("Invalid compaction checkpoints");
    ids.add(entry.id);
    previous = entry.firstKeptMessageIndex;
  }
};
