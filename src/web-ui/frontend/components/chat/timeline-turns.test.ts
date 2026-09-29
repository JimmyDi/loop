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

test("first-message text waits for a tool call or completion before choosing its section", () => {
  const text = { type: "text" as const, text: "Inspect the file" };
  const pending = [{ index: 1, message: assistant([text]) }];
  expect(projectAssistantTurn(pending, 1)).toEqual({ activity: [], answer: undefined });
  expect(projectAssistantTurn(structuredClone(pending), 1)).toEqual({
    activity: [],
    answer: undefined,
  });
  const withCall = [
    {
      index: 1,
      message: assistant([text, { type: "toolCall", id: "call", name: "read", arguments: {} }]),
    },
  ];
  expect(projectAssistantTurn(withCall, 1).answer).toBeUndefined();
  expect(projectAssistantTurn(withCall, 1).activity).toHaveLength(1);
  expect(projectAssistantTurn(withCall).answer).toBeUndefined();
  expect(
    projectAssistantTurn([{ index: 1, message: assistant([text], "toolUse") }]).answer,
  ).toBeUndefined();
  expect(projectAssistantTurn(pending)).toEqual({ activity: [], answer: pending[0] });
  expect(
    projectAssistantTurn([{ index: 1, message: assistant([text], "toolUse") }], 1).answer,
  ).toBeUndefined();
  expect(projectAssistantTurn([{ index: 1, message: assistant([]) }], 1)).toEqual({
    activity: [],
    answer: undefined,
  });
  expect(
    projectAssistantTurn([{ index: 1, message: assistant([{ type: "text", text: "  " }]) }], 1),
  ).toEqual({ activity: [], answer: undefined });
  const thinking = [{ index: 2, message: assistant([{ type: "thinking", thinking: "Thinking" }]) }];
  expect(projectAssistantTurn(thinking).answer).toBeUndefined();
  expect(projectAssistantTurn(thinking).activity).toHaveLength(1);
  const response = {
    type: "text" as const,
    text: "## Findings\n\n- Improve rendering.\n- Reduce duplicate work.",
  };
  const mixed = [
    { index: 2, message: assistant([{ type: "thinking", thinking: "Thinking" }, response]) },
  ];
  const projected = projectAssistantTurn(mixed, 2);
  expect(projected.activity[0]?.message.content).toEqual([
    { type: "thinking", thinking: "Thinking" },
  ]);
  expect(projected.answer).toBeUndefined();
  expect(projectAssistantTurn(mixed).answer?.message.content).toEqual([response]);
});

test("explicit commentary and final phases stream into separate areas without mutating history", () => {
  const commentary = { type: "text" as const, text: "<!-- loop:commentary -->Inspect files" };
  const final = { type: "text" as const, text: "<!-- loop:final -->## Findings" };
  const messages = [{ index: 1, message: assistant([commentary]) }];
  const before = structuredClone(messages);
  expect(projectAssistantTurn(messages, 1).activity[0]?.message.content).toEqual([
    { type: "text", text: "Inspect files" },
  ]);
  expect(projectAssistantTurn(messages, 1).answer).toBeUndefined();
  expect(projectAssistantTurn(messages).answer).toBeUndefined();
  expect(messages).toEqual(before);

  const mixed = [{ index: 1, message: assistant([commentary, final]) }];
  for (const draftIndex of [1, undefined]) {
    const projected = projectAssistantTurn(mixed, draftIndex);
    expect(projected.activity[0]?.message.content).toEqual([
      { type: "text", text: "Inspect files" },
    ]);
    expect(projected.answer?.message.content).toEqual([{ type: "text", text: "## Findings" }]);
  }
  const direct = projectAssistantTurn([{ index: 1, message: assistant([final]) }], 1);
  expect(direct.activity).toEqual([]);
  expect(direct.answer?.message.content).toEqual([{ type: "text", text: "## Findings" }]);
  const native = {
    type: "text" as const,
    text: "Update",
    textSignature: JSON.stringify({ v: 1, id: "text", phase: "commentary" }),
  };
  expect(
    projectAssistantTurn([{ index: 1, message: assistant([native]) }], 1).activity[0]?.message
      .content,
  ).toEqual([native]);
});

test("text after tools waits for its destination while thinking keeps streaming", () => {
  const call = { type: "toolCall" as const, id: "first", name: "read", arguments: {} };
  const history = [
    { index: 1, message: assistant([call], "toolUse") },
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

  // Wording and Markdown cannot classify a progress update or a final answer.
  for (const text of ["Read another file next.", "## Findings\n\n- Configuration checked."]) {
    const content = [thought, { type: "text" as const, text }];
    const draft = { index: 3, message: assistant(content) };
    const messages = [...history, draft];
    const before = structuredClone(messages);
    const pending = projectAssistantTurn(messages, 3);
    expect(pending.answer).toBeUndefined();
    expect(pending.activity.map((entry) => entry.index)).toEqual([1, 3]);
    expect(pending.activity[1]?.message.content).toEqual([thought]);
    expect(projectAssistantTurn(structuredClone(messages), 3)).toEqual(pending);
    expect(messages).toEqual(before);

    const withCall = {
      ...draft,
      message: assistant([...content, { ...call, id: "next" }]),
    };
    const confirmed = projectAssistantTurn([...history, withCall], 3);
    expect(confirmed.answer).toBeUndefined();
    expect(confirmed.activity).toEqual([history[0]!, withCall]);

    const completed = projectAssistantTurn(messages);
    expect(completed.activity).toEqual(pending.activity);
    expect(completed.answer?.message.content).toEqual([{ type: "text", text }]);
    for (const stopReason of ["error", "aborted"] as const) {
      const stopped = {
        ...draft,
        message: { ...draft.message, stopReason, errorMessage: "Stopped" },
      };
      const result = projectAssistantTurn([...history, stopped]);
      expect(result.answer?.message.content).toEqual([{ type: "text", text }]);
      expect(result.answer?.message.errorMessage).toBe("Stopped");
    }
  }

  const orphan = [{ ...history[1]!, index: 0 }];
  const draft = { index: 1, message: assistant([{ type: "text", text: "Follow up" }]) };
  expect(projectAssistantTurn([...orphan, draft], 1)).toEqual({
    activity: orphan,
    answer: undefined,
  });
  expect(projectAssistantTurn([draft], 1)).toEqual({ activity: [], answer: undefined });
  expect(projectAssistantTurn([draft])).toEqual({ activity: [], answer: draft });
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
