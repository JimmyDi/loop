import { expect, test } from "vitest";

import { timingForTurn } from "./timeline-timing";

test("each continuation uses its own duration rather than replacing a stopped attempt", () => {
  const first = {
    id: "a",
    userMessageIndex: 0,
    messageStartIndex: 1,
    messageEndIndex: 2,
    startedAt: 0,
    finishedAt: 1000,
    stopped: true,
  };
  const next = { id: "b", userMessageIndex: 0, messageStartIndex: 2, startedAt: 2000 };
  expect(
    timingForTurn([first, next], {
      type: "assistant",
      index: 1,
      userMessageIndex: 0,
      messages: [],
    }),
  ).toBe(first);
  expect(
    timingForTurn([first, next], {
      type: "assistant",
      index: 2,
      userMessageIndex: 0,
      messages: [],
    }),
  ).toBe(next);
});
