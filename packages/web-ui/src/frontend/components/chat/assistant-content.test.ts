import { expect, test } from "vitest";

import type { Message } from "../../../shared/protocol";
import { groupAssistantContent } from "./assistant-content";

type Content = Extract<Message, { role: "assistant" }>["content"];

const call = (id: string): Extract<Content[number], { type: "toolCall" }> => ({
  type: "toolCall",
  id,
  name: "read",
  arguments: {},
});

test("visible text separates stable tool batches while hidden thinking does not", () => {
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

  expect(blocks.map((block) => block.type)).toEqual(["text", "tools", "text", "tools"]);
  expect(blocks.filter((block) => block.type === "tools")).toMatchObject([
    { key: "tools:first", calls: [{ id: "first" }, { id: "second" }] },
    { key: "tools:third", calls: [{ id: "third" }, { id: "fourth" }] },
  ]);
  expect(content).toEqual(original);
  expect(groupAssistantContent(content.slice(0, 3))[1]?.key).toBe(blocks[1]?.key);
});

test("thinking is omitted while whitespace text preserves content positions", () => {
  const blocks = groupAssistantContent([
    { type: "thinking", thinking: "Model thinking" },
    call("first"),
    { type: "text", text: "  " },
    call("second"),
    { type: "text", text: "Next message" },
  ]);

  expect(blocks.filter((block) => block.type === "tools")).toMatchObject([
    { calls: [{ id: "first" }] },
    { calls: [{ id: "second" }] },
  ]);
  expect(groupAssistantContent([call("third")])[0]).toMatchObject({ calls: [{ id: "third" }] });
  expect(groupAssistantContent([{ type: "thinking", thinking: "Returned thinking" }])).toEqual([]);
  expect(groupAssistantContent([{ type: "text", text: "Answer" }])).toEqual([
    { type: "text", key: "text:0", text: "Answer" },
  ]);
});

test("text blocks stay literal without prefix filtering", () => {
  for (const text of ["<", "<!-- loop:comm", "<!-- loop:final -->Answer", "  Answer"]) {
    expect(groupAssistantContent([{ type: "text", text }])).toEqual([
      { type: "text", key: "text:0", text },
    ]);
  }
});
