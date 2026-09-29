import { expect, test } from "bun:test";

import type { Message } from "../../../shared/protocol";
import { fileContent } from "../../../shared/prompt-files";
import { groupTimelineTurns, projectAssistantTurn } from "./timeline-turns";

type Assistant = Extract<Message, { role: "assistant" }>;

const assistant = (
  content: Assistant["content"],
  stopReason: Assistant["stopReason"] = "stop",
): Assistant => ({
  role: "assistant",
  content,
  stopReason,
  api: "openai-completions",
  provider: "test",
  model: "test",
  timestamp: 0,
  usage: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
});

test("one activity per user turn preserves intermediate messages and excludes paired results", () => {
  const messages: Message[] = [
    { role: "user", content: "Check the project", timestamp: 0 },
    assistant(
      [
        { type: "text", text: "Inspect files" },
        { type: "toolCall", id: "a", name: "read", arguments: {} },
      ],
      "toolUse",
    ),
    {
      role: "toolResult",
      toolCallId: "a",
      toolName: "read",
      content: [],
      isError: true,
      timestamp: 0,
    },
    assistant(
      [
        { type: "text", text: "Try another file" },
        { type: "toolCall", id: "b", name: "read", arguments: {} },
      ],
      "toolUse",
    ),
    {
      role: "toolResult",
      toolCallId: "b",
      toolName: "read",
      content: [],
      isError: false,
      timestamp: 0,
    },
    assistant([
      { type: "thinking", thinking: "Model thought" },
      { type: "text", text: "Checked" },
    ]),
    { role: "user", content: "Next request", timestamp: 0 },
    assistant([{ type: "text", text: "Direct answer" }]),
  ];
  const before = structuredClone(messages);
  const turns = groupTimelineTurns(messages);
  expect(turns.map((turn) => [turn.type, turn.index])).toEqual([
    ["user", 0],
    ["assistant", 1],
    ["user", 6],
    ["assistant", 7],
  ]);
  const first = turns[1]!;
  if (first.type !== "assistant") throw new Error("Expected assistant turn");
  const { activity, answer } = projectAssistantTurn(first.messages);
  expect(activity.map((entry) => entry.index)).toEqual([1, 3, 5]);
  expect(answer?.message.content).toEqual([{ type: "text", text: "Checked" }]);
  expect(first.title).toBe("Check the project");
  const second = turns[3]!;
  if (second.type !== "assistant") throw new Error("Expected second turn");
  expect(projectAssistantTurn(second.messages).activity).toEqual([]);
  expect(messages).toEqual(before);
});

test("unclassified live text streams outside reasoning until a tool call identifies an update", () => {
  const text = { type: "text" as const, text: "Inspect the file" };
  const pending = [{ index: 1, message: assistant([text]) }];
  expect(projectAssistantTurn(pending, 1)).toEqual({ activity: [], answer: pending[0] });
  expect(projectAssistantTurn(pending)).toEqual({ activity: [], answer: pending[0] });
  const withCall = [
    {
      index: 1,
      message: assistant([text, { type: "toolCall", id: "call", name: "read", arguments: {} }]),
    },
  ];
  expect(projectAssistantTurn(withCall, 1)).toEqual({ activity: withCall, answer: undefined });
  expect(projectAssistantTurn(withCall).answer).toBeUndefined();
  expect(
    projectAssistantTurn([{ index: 1, message: assistant([text], "toolUse") }]).answer,
  ).toBeUndefined();
  for (const content of [[], [{ type: "text" as const, text: "  " }]]) {
    expect(projectAssistantTurn([{ index: 1, message: assistant(content) }], 1)).toEqual({
      activity: [],
      answer: undefined,
    });
  }
});

test("native phases route live text while tool calls retain their associated updates", () => {
  const commentary = {
    type: "text" as const,
    text: "Inspect files",
    textSignature: JSON.stringify({ v: 1, id: "update", phase: "commentary" }),
  };
  const final = {
    type: "text" as const,
    text: "## Findings",
    textSignature: JSON.stringify({ v: 1, id: "reply", phase: "final_answer" }),
  };
  const messages = [{ index: 1, message: assistant([commentary, final]) }];
  const before = structuredClone(messages);
  const live = projectAssistantTurn(messages, 1);
  expect(live.answer?.message.content).toEqual([final]);
  expect(live.activity[0]?.message.content).toEqual([commentary]);
  const done = projectAssistantTurn(messages);
  expect(done.activity[0]?.message.content).toEqual([commentary]);
  expect(done.answer?.message.content).toEqual([final]);
  const native = {
    type: "text" as const,
    text: "Answer",
    textSignature: JSON.stringify({ v: 1, id: "text", phase: "final_answer" }),
  };
  expect(
    projectAssistantTurn([{ index: 1, message: assistant([native]) }], 1).answer?.message.content,
  ).toEqual([native]);
  const update = {
    ...native,
    text: "Inspect files",
    textSignature: JSON.stringify({ v: 1, id: "text", phase: "commentary" }),
  };
  expect(projectAssistantTurn([{ index: 1, message: assistant([update]) }], 1)).toEqual({
    activity: [{ index: 1, message: assistant([update]) }],
    answer: undefined,
  });
  const withTool = [
    {
      index: 1,
      message: assistant(
        [native, { type: "toolCall", id: "tool", name: "read", arguments: {} }],
        "toolUse",
      ),
    },
  ];
  expect(projectAssistantTurn(withTool).answer).toBeUndefined();
  expect(messages).toEqual(before);
});

test("text prefixes do not route, trim or buffer a live reply", () => {
  for (const text of ["<", "<!-- loop:comm", "<!-- loop:commentary -->Inspect files", "  Answer"]) {
    const entry = { index: 1, message: assistant([{ type: "text", text }]) };
    expect(projectAssistantTurn([entry], 1)).toEqual({ activity: [], answer: entry });
  }
});

test("multiple batches, thinking and final reply keep order across reconnect and settlement", () => {
  const call = { type: "toolCall" as const, id: "first", name: "read", arguments: {} };
  const history = [
    { index: 1, message: assistant([{ type: "text", text: "Inspect files" }, call], "toolUse") },
    {
      index: 2,
      message: {
        role: "toolResult" as const,
        toolCallId: call.id,
        toolName: call.name,
        content: [],
        isError: false,
        timestamp: 0,
      },
    },
  ];
  const thought = { type: "thinking" as const, thinking: "Consider the result" };
  for (const text of ["Read another file next.", "## Findings\n\n- Configuration checked."]) {
    const draft = { index: 3, message: assistant([thought, { type: "text" as const, text }]) };
    const messages = [...history, draft];
    const before = structuredClone(messages);
    const live = projectAssistantTurn(messages, 3);
    expect(live.activity.map((entry) => entry.index)).toEqual([1, 3]);
    expect(live.activity[1]?.message.content).toEqual([thought]);
    expect(live.answer?.message.content).toEqual([{ type: "text", text }]);
    expect(projectAssistantTurn(structuredClone(messages), 3)).toEqual(live);
    const withCall = {
      ...draft,
      message: assistant([...draft.message.content, { ...call, id: "next" }]),
    };
    expect(projectAssistantTurn([...history, withCall], 3)).toEqual({
      activity: [history[0], withCall],
      answer: undefined,
    });
    const done = projectAssistantTurn(messages);
    expect(done.activity.map((entry) => entry.index)).toEqual([1, 3]);
    expect(done.activity[1]?.message.content).toEqual([thought]);
    expect(done.answer?.message.content).toEqual([{ type: "text", text }]);
    expect(messages).toEqual(before);
    for (const stopReason of ["error", "aborted", "length"] as const) {
      const stopped = {
        ...draft,
        message: { ...draft.message, stopReason, errorMessage: "Stopped" },
      };
      const result = projectAssistantTurn([...history, stopped]);
      expect(result.answer?.message.content).toEqual([{ type: "text", text }]);
      expect(result.answer?.message.stopReason).toBe(stopReason);
      expect(result.answer?.message.errorMessage).toBe("Stopped");
    }
  }
  const thoughtOnly = [{ index: 1, message: assistant([thought]) }];
  expect(projectAssistantTurn(thoughtOnly)).toEqual({ activity: thoughtOnly, answer: undefined });
});

test("orphan results and failure messages remain visible without inventing a final answer", () => {
  const result: Extract<Message, { role: "toolResult" }> = {
    role: "toolResult",
    toolCallId: "orphan",
    toolName: "read",
    content: [],
    isError: true,
    timestamp: 0,
  };
  expect(projectAssistantTurn([{ index: 0, message: result }]).activity).toHaveLength(1);
  const error = { ...assistant([], "error"), errorMessage: "Model unavailable" };
  expect(projectAssistantTurn([{ index: 1, message: error }]).answer?.message.errorMessage).toBe(
    "Model unavailable",
  );
  expect(projectAssistantTurn([{ index: 1, message: assistant([]) }])).toEqual({
    activity: [],
    answer: undefined,
  });
  for (const stopReason of ["error", "aborted"] as const) {
    const stopped = {
      ...assistant([{ type: "text", text: "Partial response" }], stopReason),
      errorMessage: "Execution stopped",
    };
    expect(projectAssistantTurn([{ index: 1, message: stopped }]).answer?.message).toEqual(stopped);
  }
});

test("group titles exclude attachment contents and preserve user-request boundaries", () => {
  const turns = groupTimelineTurns([
    {
      role: "user",
      content: [
        { type: "text", text: fileContent({ name: "sample.ts", text: "Reference content" }) },
        { type: "text", text: "  Check\n  this file " },
      ],
      timestamp: 0,
    },
    assistant([]),
    {
      role: "user",
      content: [
        { type: "text", text: fileContent({ name: "sample.ts", text: "Reference content" }) },
      ],
      timestamp: 0,
    },
    assistant([]),
  ]);
  expect(turns[1]).toMatchObject({ title: "Check this file" });
  expect(turns[3]).toMatchObject({ title: "" });
});
