import { expect, test } from "bun:test";

import type { Message } from "../../../shared/protocol";
import { activityFailures, activityStatus, executionStatus } from "./activity-status";

const final = {
  role: "assistant",
  stopReason: "stop",
  content: [{ type: "text", text: "Answer" }],
} as Extract<Message, { role: "assistant" }>;

test("run outcome is independent of recovered tool failures and never claims unknown completion", () => {
  const message = [{ index: 1, message: final }];
  expect(activityStatus(message, true)).toBe("running");
  expect(activityStatus(message, false)).toBe("success");
  expect(activityStatus(message, false, "cancelled")).toBe("cancelled");
  expect(activityStatus(message, false, "error")).toBe("error");
  for (const stopReason of ["error", "length", "aborted"] as const) {
    expect(activityStatus([{ index: 1, message: { ...final, stopReason } }], false)).toBe(
      stopReason === "aborted" ? "cancelled" : "error",
    );
  }
  expect(activityStatus([], false)).toBe("idle");
  const call = { type: "toolCall" as const, id: "a", name: "read", arguments: {} };
  const entries = [{ index: 1, message: { ...final, content: [call] } }];
  expect(activityStatus(entries, false)).toBe("idle");
  expect(activityFailures(entries, { a: { id: "a", name: "read", status: "error" } })).toBe(1);
});

test("execution status finishes at thinking end and resumes for more reasoning or tools", () => {
  const thought = { type: "thinking" as const, thinking: "Check the result" };
  const messages = [{ index: 1, message: { ...final, content: [thought] } }];
  expect(executionStatus(messages, {}, true, "idle", "thinking")).toBe("running");
  expect(executionStatus(messages, {}, true, "idle", "thinking-complete")).toBe("success");
  expect(executionStatus(messages, {}, true, "idle", "text")).toBe("success");
  expect(executionStatus(messages, {}, true, "idle", "thinking")).toBe("running");
  expect(executionStatus([{ index: 1, message: final }], {}, true)).toBe("success");
  expect(executionStatus(messages, {}, true)).toBe("running");

  const call = { type: "toolCall" as const, id: "call", name: "read", arguments: {} };
  const withTool = [{ index: 1, message: { ...final, content: [thought, call] } }];
  for (const status of ["waiting", "running"] as const) {
    expect(
      executionStatus(
        withTool,
        { call: { id: "call", name: "read", status } },
        true,
        "idle",
        "thinking-complete",
      ),
    ).toBe("running");
  }
  expect(executionStatus(withTool, {}, true, "idle", "text")).toBe("running");
  const tools = { call: { id: "call", name: "read", status: "error" as const } };
  expect(executionStatus(withTool, tools, true, "idle", "text")).toBe("success");
  expect(executionStatus(withTool, tools, true, "idle", "tool")).toBe("running");
  expect(executionStatus(messages, {}, false, "cancelled", "text")).toBe("cancelled");
  expect(executionStatus(messages, {}, false, "error", "thinking-complete")).toBe("error");
  const update = [
    {
      index: 1,
      message: {
        ...final,
        content: [{ type: "text" as const, text: "<!-- loop:commentary -->Read files" }],
      },
    },
  ];
  expect(executionStatus(update, {}, true, "idle", "text")).toBe("running");
  const answer = [
    {
      index: 1,
      message: { ...final, content: [{ type: "text" as const, text: "<!-- loop:final -->Done" }] },
    },
  ];
  expect(executionStatus(answer, {}, true, "idle", "text")).toBe("success");
});
