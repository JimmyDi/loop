import { expect, test } from "vitest";

import { fallbackTitle, normalizeTitle, validTitle } from "./title-text";

test("titles strip controls, collapse whitespace and preserve UTF-8 boundaries", () => {
  expect(normalizeTitle("\u001b[31m Hello\n world\u001b[0m\u202e")).toBe("Hello world");
  expect(normalizeTitle("\u001b]0;hidden\u0007Visible")).toBe("Visible");
  expect(normalizeTitle("你好🙂", 8)).toBe("你好");
  expect(
    fallbackTitle({ index: 2, text: "one two three four five six seven eight nine" }).text,
  ).toBe("one two three four five six seven eight");
  expect(validTitle({ text: "Task", source: "model", messageIndices: [2, 0] })).toBe(false);
  expect(validTitle({ text: "Task", source: "user", messageIndices: [] })).toBe(true);
});
