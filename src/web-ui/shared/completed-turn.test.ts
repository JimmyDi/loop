import { expect, test } from "bun:test";

import { latestCompletedTurn } from "./completed-turn";

test("completed turn identity excludes active runs, empty outcomes and legacy history", () => {
  expect(latestCompletedTurn(undefined, 2)).toBeUndefined();
  expect(latestCompletedTurn([{ userMessageIndex: 0, startedAt: 0 }], 2)).toBeUndefined();
  const first = { userMessageIndex: 0, startedAt: 0, finishedAt: 10 };
  expect(latestCompletedTurn([first], 1)).toBeUndefined();
  expect(latestCompletedTurn([first], 2)).toBe(0);
  const second = { userMessageIndex: 2, startedAt: 20, finishedAt: 30 };
  expect(latestCompletedTurn([first, second], 4)).toBe(2);
  expect(latestCompletedTurn([first, { ...second, finishedAt: undefined }], 4)).toBe(0);
  expect(latestCompletedTurn([first, { ...second, userMessageIndex: 1 }], 3)).toBe(1);
  expect(latestCompletedTurn([first, { userMessageIndex: 1, startedAt: 20 }], 3)).toBeUndefined();
});
