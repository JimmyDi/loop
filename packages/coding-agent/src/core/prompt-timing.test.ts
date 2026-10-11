import { expect, test } from "vitest";

import { validatePromptTimings } from "./prompt-timing";

test("only completed, ordered prompt timings referencing user messages may be stored", () => {
  const messages = [{ role: "user" as const, content: "Request", timestamp: 0 }];
  const timing = { userMessageIndex: 0, startedAt: 1000, finishedAt: 3000 };
  expect(() => validatePromptTimings(undefined, messages)).not.toThrow();
  expect(() => validatePromptTimings([timing], messages)).not.toThrow();
  for (const invalid of [
    null,
    {},
    [timing, timing],
    [{ ...timing, userMessageIndex: 1 }],
    [{ ...timing, startedAt: -1 }],
    [{ ...timing, finishedAt: 999 }],
    [{ ...timing, finishedAt: undefined }],
    [{ ...timing, startedAt: 0.5 }],
  ]) {
    expect(() => validatePromptTimings(invalid, messages)).toThrow("Invalid prompt timings");
  }
});

test("resumed attempts share a user anchor but keep distinct IDs and ordered ranges", () => {
  const messages = [{ role: "user" as const, content: "Request", timestamp: 0 }];
  const first = {
    id: "first",
    userMessageIndex: 0,
    messageStartIndex: 1,
    messageEndIndex: 1,
    startedAt: 1000,
    finishedAt: 2000,
    stopped: true,
  };
  const resumed = { ...first, id: "resumed", startedAt: 3000, finishedAt: 3000 };
  expect(() => validatePromptTimings([first, resumed], messages)).not.toThrow();
  for (const invalid of [
    { ...resumed, id: first.id },
    { ...resumed, messageEndIndex: 2 },
    { ...resumed, messageStartIndex: 0 },
    { ...resumed, stopped: "yes" },
  ]) {
    expect(() => validatePromptTimings([first, invalid], messages)).toThrow(
      "Invalid prompt timings",
    );
  }
});
