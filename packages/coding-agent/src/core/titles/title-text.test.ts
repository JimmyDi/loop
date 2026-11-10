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

test("each OSC escape is stripped up to its own terminator", () => {
  const st = "\u001b\\";
  expect(normalizeTitle(`\u001b]0;hidden${st}Keep me\u001b]0;hidden${st} visible`)).toBe(
    "Keep me visible",
  );
  expect(normalizeTitle(`\u001b]0;hidden\u0007Keep me\u001b]2;hidden${st} visible`)).toBe(
    "Keep me visible",
  );
  expect(normalizeTitle(`\u001b]0;hidden${st}\u001b]0;hidden\u0007Visible`)).toBe("Visible");
});
