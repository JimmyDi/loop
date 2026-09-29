import { expect, test } from "bun:test";

import type { Message } from "../../../shared/protocol";
import { groupAssistantContent } from "./assistant-content";

type Content = Extract<Message, { role: "assistant" }>["content"];

const call = (id: string): Extract<Content[number], { type: "toolCall" }> => ({
  type: "toolCall",
  id,
  name: "read",
  arguments: {},
});

test("consecutive calls share a stable group, with text and thinking preserved in order", () => {
  const content: Content = [
    { type: "text", text: "Read the configuration." },
    { type: "thinking", thinking: "Model thinking" },
    call("first"),
    call("second"),
    { type: "text", text: "Check the referenced files." },
    call("third"),
    { type: "thinking", thinking: "More thinking" },
    call("fourth"),
  ];
  const original = structuredClone(content);
  const blocks = groupAssistantContent(content);

  expect(blocks.map((block) => block.type)).toEqual([
    "text",
    "thinking",
    "tools",
    "text",
    "tools",
    "thinking",
    "tools",
  ]);
  expect(blocks.filter((block) => block.type === "tools")).toMatchObject([
    { key: "tools:first", hasPreamble: true, calls: [{ id: "first" }, { id: "second" }] },
    { key: "tools:third", hasPreamble: true, calls: [{ id: "third" }] },
    { key: "tools:fourth", hasPreamble: false, calls: [{ id: "fourth" }] },
  ]);
  expect(content).toEqual(original);
  expect(groupAssistantContent(content.slice(0, 3))[2]?.key).toBe(blocks[2]?.key);
});

test("thinking, empty text and previous messages do not replace a missing preamble", () => {
  const blocks = groupAssistantContent([
    { type: "thinking", thinking: "Model thinking" },
    call("first"),
    { type: "text", text: "  " },
    call("second"),
    { type: "text", text: "Next message" },
  ]);

  expect(blocks.filter((block) => block.type === "tools")).toMatchObject([
    { hasPreamble: false, calls: [{ id: "first" }] },
    { hasPreamble: false, calls: [{ id: "second" }] },
  ]);
  expect(groupAssistantContent([call("third")])[0]).toMatchObject({ hasPreamble: false });
  expect(groupAssistantContent([{ type: "text", text: "Answer" }])).toEqual([
    { type: "text", key: "text:0", text: "Answer" },
  ]);
});
