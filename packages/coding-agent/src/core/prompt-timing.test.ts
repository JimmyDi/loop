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
