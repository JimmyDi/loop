import { expect, test } from "bun:test";
import type { Message } from "@earendil-works/pi-ai";

import { messageText } from "./messages";

test("SDK text extraction preserves literal text without display-marker filtering", () => {
  expect(messageText()).toBe("");
  expect(messageText({ role: "user", content: "Hello", timestamp: 0 })).toBe("Hello");
  for (const text of ["  Hello", "<", "<!-- loop:comm", "<!-- loop:final -->Answer"]) {
    for (const role of ["assistant", "user", "toolResult"] as const) {
      const message = { role, content: [{ type: "text", text }] } as Message;
      expect(messageText(message)).toBe(text);
    }
  }
  expect(
    messageText({
      role: "assistant",
      content: [
        { type: "text", text: "Hello" },
        { type: "thinking", thinking: "Model thinking" },
        { type: "toolCall", id: "call", name: "read", arguments: {} },
        { type: "text", text: " world" },
      ],
    } as Message),
  ).toBe("Hello world");
});
