import { expect, test } from "bun:test";

import { readAssistantText } from "./assistant-text";
import { readAssistantText as readTerminalText } from "../../coding-agent/core/assistant-text";

test("display markers work across every stream split without exposing marker bytes", () => {
  for (const [marker, phase] of [
    ["<!-- loop:commentary -->", "commentary"],
    ["<!-- loop:final -->", "final_answer"],
  ] as const) {
    for (let index = 1; index < marker.length; index++) {
      const part = { type: "text" as const, text: "  " + marker.slice(0, index) };
      expect(readAssistantText(part, true).text).toBe("");
      expect(readTerminalText(part, true).text).toBe("");
    }
    const source = marker + "\nInspect files";
    for (let index = marker.length; index <= source.length; index++) {
      const part = { type: "text" as const, text: source.slice(0, index) };
      expect(readAssistantText(part, true)).toEqual({
        phase,
        text: source.slice(marker.length, index).trimStart(),
      });
      expect(readTerminalText(part, true).text).toBe(readAssistantText(part, true).text);
    }
  }
});

test("native phase metadata is recognized without interpreting opaque signatures or body examples", () => {
  for (const phase of ["commentary", "final_answer"] as const) {
    expect(
      readAssistantText(
        { type: "text", text: "Hello", textSignature: JSON.stringify({ v: 1, id: "text", phase }) },
        true,
      ),
    ).toEqual({ text: "Hello", phase });
  }
  for (const signature of [
    undefined,
    "opaque",
    "{bad",
    "null",
    '{"phase":"commentary"}',
    '{"v":2,"id":"text","phase":"commentary"}',
  ]) {
    expect(
      readAssistantText({ type: "text", text: "Plain text", textSignature: signature }, true).phase,
    ).toBeUndefined();
  }
  for (const text of [
    "Example: <!-- loop:commentary -->",
    "```html\n<!-- loop:final -->\n```",
    "<!-- unrelated -->Keep",
    "<",
  ]) {
    expect(readAssistantText({ type: "text", text }).text).toBe(text);
    expect(readTerminalText({ type: "text", text }).text).toBe(text);
  }
  expect(readAssistantText({ type: "text", text: "<!-- loop:comm" }).text).toBe("");
});
