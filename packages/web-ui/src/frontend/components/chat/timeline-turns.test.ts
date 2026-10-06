import { expect, test } from "vitest";

import type { Message } from "../../../shared/protocol";
import { groupTimelineTurns, projectAssistantTurn } from "./timeline-turns";

const assistant = (
  content: Extract<Message, { role: "assistant" }>["content"],
  stopReason: Extract<Message, { role: "assistant" }>["stopReason"] = "stop",
): Extract<Message, { role: "assistant" }> => ({
  role: "assistant",
  content,
  stopReason,
  timestamp: 0,
  api: "openai-completions",
  provider: "test",
  model: "test",
  usage: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
});

test("user turns preserve message positions and isolate conversations", () => {
  const messages: Message[] = [
    { role: "user", content: "First request", timestamp: 0 },
    assistant([{ type: "text", text: "First update" }]),
    assistant([{ type: "toolCall", id: "a", name: "read", arguments: {} }], "toolUse"),
    { role: "user", content: [], timestamp: 0 },
    assistant([{ type: "text", text: "Second answer" }]),
  ];
  const turns = groupTimelineTurns(messages);
  expect(turns.map((turn) => [turn.type, turn.index])).toEqual([
    ["user", 0],
    ["assistant", 1],
    ["user", 3],
    ["assistant", 4],
  ]);
  expect(turns[1]).toMatchObject({ userMessageIndex: 0, messages: [{ index: 1 }, { index: 2 }] });
  expect(turns[3]).toMatchObject({ userMessageIndex: 3, messages: [{ index: 4 }] });
});

test("flat projection keeps updates, tool batches and final text in order without paired result duplicates", () => {
  const first = assistant(
    [
      { type: "text", text: "Inspect the configuration and its references." },
      { type: "thinking", thinking: "Hidden thinking" },
      { type: "toolCall", id: "a", name: "read", arguments: {} },
      { type: "toolCall", id: "b", name: "read", arguments: {} },
    ],
    "toolUse",
  );
  const entries = [
    { index: 1, message: first },
    {
      index: 2,
      message: {
        role: "toolResult" as const,
        toolCallId: "a",
        toolName: "read",
        content: [],
        isError: false,
        timestamp: 0,
      },
    },
    {
      index: 3,
      message: {
        role: "toolResult" as const,
        toolCallId: "b",
        toolName: "read",
        content: [],
        isError: true,
        timestamp: 0,
      },
    },
    {
      index: 4,
      message: assistant([{ type: "toolCall", id: "c", name: "bash", arguments: {} }], "toolUse"),
    },
    { index: 5, message: assistant([{ type: "text", text: "Verification complete." }]) },
  ];
  const original = structuredClone(entries);
  const visible = projectAssistantTurn(entries);
  expect(visible.map((entry) => entry.index)).toEqual([1, 4, 5]);
  expect(visible[0]?.message).toBe(first);
  expect(entries).toEqual(original);
  expect(projectAssistantTurn(structuredClone(entries))).toEqual(visible);
});

test("thinking-only drafts stay hidden without filtering raw history or suppressing failures", () => {
  const thought = assistant([{ type: "thinking", thinking: "Hidden thinking" }]);
  expect(projectAssistantTurn([{ index: 1, message: thought }])).toEqual([]);
  expect(thought.content).toHaveLength(1);
  const error = { ...thought, stopReason: "error" as const, errorMessage: "Connection failed" };
  expect(projectAssistantTurn([{ index: 1, message: error }])).toEqual([
    { index: 1, message: error },
  ]);
  const orphan = {
    role: "toolResult" as const,
    toolCallId: "orphan",
    toolName: "read",
    content: [],
    isError: true,
    timestamp: 0,
  };
  expect(projectAssistantTurn([{ index: 0, message: orphan }])).toHaveLength(1);
  expect(projectAssistantTurn([{ index: 1, message: assistant([]) }])).toEqual([]);
});

test("native phases and later calls never relocate text or rewrite partial failures", () => {
  for (const phase of [undefined, "commentary", "final_answer"]) {
    const text = {
      type: "text" as const,
      text: "Inspect the configuration.",
      textSignature: phase ? JSON.stringify({ v: 1, id: "text", phase }) : undefined,
    };
    const draft = { index: 1, message: assistant([text]) };
    expect(projectAssistantTurn([draft])).toEqual([draft]);
    const withCall = {
      index: 1,
      message: assistant(
        [text, { type: "toolCall", id: "call", name: "read", arguments: {} }],
        "toolUse",
      ),
    };
    expect(projectAssistantTurn([withCall])).toEqual([withCall]);
    for (const stopReason of ["error", "aborted", "length"] as const) {
      const stopped = {
        index: 1,
        message: { ...draft.message, stopReason, errorMessage: "Stopped" },
      };
      expect(projectAssistantTurn([stopped])).toEqual([stopped]);
    }
  }
});
