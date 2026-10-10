import type { Message } from "@earendil-works/pi-ai";

export type SystemPromptCheckpoint = {
  messageCount: number;
  timestamp: number;
  sections: Record<string, string | null>;
};

/** Retain changed rendered sections separately from user conversation. */
export const prepareSystemPromptState = (
  retained: readonly SystemPromptCheckpoint[],
  prompt: string,
  messageCount: number,
): SystemPromptCheckpoint[] => {
  const current: Record<string, string> = {};
  const pattern = /^<([a-z][a-z0-9_-]*)>\n[\s\S]*?^<\/\1>(?=\n|$)/gm;
  let cursor = 0;
  for (const match of prompt.matchAll(pattern)) {
    const before = prompt.slice(cursor, match.index).trim();
    if (before) current.preamble = (current.preamble ? current.preamble + "\n\n" : "") + before;
    current[match[1]!] = match[0];
    cursor = match.index + match[0].length;
  }
  const tail = prompt.slice(cursor).trim();
  if (tail) current.preamble = (current.preamble ? current.preamble + "\n\n" : "") + tail;
  const previous: Record<string, string> = {};
  for (const entry of retained) {
    for (const [name, content] of Object.entries(entry.sections)) {
      if (content === null) delete previous[name];
      else previous[name] = content;
    }
  }
  const patch: Record<string, string | null> = {};
  for (const [name, text] of Object.entries(current)) {
    if (previous[name] !== text) patch[name] = text;
  }
  for (const name of Object.keys(previous)) {
    if (!(name in current)) patch[name] = null;
  }
  return Object.keys(patch).length
    ? [...structuredClone(retained), { messageCount, timestamp: Date.now(), sections: patch }]
    : structuredClone([...retained]);
};

export const validateSystemPromptState = (value: unknown, messages: readonly Message[]): void => {
  if (value === undefined) return;
  if (!Array.isArray(value)) throw new Error("Invalid system prompt checkpoints");
  let previous = 0;
  for (const entry of value) {
    if (
      !entry ||
      !Number.isSafeInteger(entry.messageCount) ||
      entry.messageCount < previous ||
      entry.messageCount < 1 ||
      entry.messageCount > messages.length ||
      !Number.isSafeInteger(entry.timestamp) ||
      entry.timestamp < 0 ||
      !entry.sections ||
      typeof entry.sections !== "object" ||
      Array.isArray(entry.sections) ||
      !Object.keys(entry.sections).length ||
      Object.entries(entry.sections).some(
        ([name, text]) =>
          !/^[a-z][a-z0-9_-]*$/.test(name) || (text !== null && typeof text !== "string"),
      )
    )
      throw new Error("Invalid system prompt checkpoints");
    previous = entry.messageCount;
  }
};
