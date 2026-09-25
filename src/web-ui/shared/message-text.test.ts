import { expect, test } from "bun:test";

import { messageText } from "./message-text";

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
