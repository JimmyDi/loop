import { expect, test } from "vitest";

import { speechSegments } from "./speech-segments";

test("retains every sentence and splits long Unicode text without breaking surrogate pairs", () => {
  const text = "第一句。Second sentence!" + "😀长句".repeat(100);
  const segments = speechSegments(text);
  expect(segments.join("")).toBe(text);
  expect(segments.every((part) => part.length <= 110)).toBe(true);
  expect(segments.every((part) => part.isWellFormed())).toBe(true);
  expect(speechSegments(" \n ")).toEqual([]);
});
