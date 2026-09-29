import { expect, test } from "bun:test";
import type { Message } from "@earendil-works/pi-ai";

import { readAssistantText } from "./assistant-text";
import { messageText } from "./messages";

test("terminal and SDK display text strip only leading assistant display markers", () => {
  for (const marker of ["<!-- loop:commentary -->", "<!-- loop:final -->"]) {
    const content = [{ type: "text" as const, text: marker + " Hello" }];
    expect(readAssistantText(content[0]!)).toEqual({ text: "Hello" });
    expect(messageText({ role: "assistant", content } as Message)).toBe("Hello");
    expect(messageText({ role: "user", content, timestamp: 0 })).toBe(marker + " Hello");
    expect(messageText({ role: "toolResult", content } as Message)).toBe(marker + " Hello");
    for (let index = 1; index < marker.length; index++) {
      expect(readAssistantText({ type: "text", text: marker.slice(0, index) }, true).text).toBe("");
    }
  }
  expect(readAssistantText({ type: "text", text: "Example <!-- loop:final -->" }).text).toBe(
    "Example <!-- loop:final -->",
  );
});
