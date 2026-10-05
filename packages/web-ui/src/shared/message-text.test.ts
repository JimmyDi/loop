import { expect, test } from "vitest";

import { messageText } from "./message-text";
import type { Message } from "./protocol";

test("display text handles string and block content without exposing nontext data", () => {
  expect(messageText({ role: "user", content: "hello", timestamp: 0 })).toBe("hello");
  expect(
    messageText({
      role: "user",
      content: [
        { type: "text", text: "first" },
        { type: "text", text: "second" },
      ],
      timestamp: 0,
    }),
  ).toBe("first\nsecond");
});

test("copy text preserves literal content for every message role", () => {
  const content = [{ type: "text" as const, text: "<!-- loop:final -->Answer" }];
  expect(messageText({ role: "assistant", content } as Message)).toBe(content[0]!.text);
  expect(messageText({ role: "user", content, timestamp: 0 })).toBe(content[0]!.text);
  expect(messageText({ role: "toolResult", content } as Message)).toBe(content[0]!.text);
});
