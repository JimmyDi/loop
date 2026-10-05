import { expect, test } from "vitest";

import { validateRunTimings } from "./run-timing";

test("stored timing requires a unique user message and finite ordered timestamps", () => {
  const messages = [{ role: "user" as const, content: "Request", timestamp: 1000 }];
  const valid = { userMessageIndex: 0, startedAt: 1000, finishedAt: 2000 };
  expect(() => validateRunTimings(undefined, messages)).not.toThrow();
  expect(() => validateRunTimings([valid], messages)).not.toThrow();
  for (const value of [
    {},
    [null],
    [valid, valid],
    [{ ...valid, userMessageIndex: 1 }],
    [{ ...valid, userMessageIndex: -1 }],
    [{ ...valid, startedAt: NaN }],
    [{ ...valid, startedAt: -1 }],
    [{ ...valid, finishedAt: 999 }],
    [{ ...valid, finishedAt: undefined }],
    [{ ...valid, finishedAt: Infinity }],
  ])
    expect(() => validateRunTimings(value, messages)).toThrow("Invalid session run timings");
});
