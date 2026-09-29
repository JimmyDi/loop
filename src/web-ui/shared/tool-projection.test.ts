import { expect, test } from "bun:test";

import type { Message } from "./protocol";
import { projectTools, updateTools } from "./tool-projection";

test("streamed arguments keep updating without resetting execution state or losing results", () => {
  const message = {
    role: "assistant",
    content: [{ type: "toolCall", id: "call", name: "read", arguments: {} }],
  } as Extract<Message, { role: "assistant" }>;
  const initial = projectTools([message]);
  const completed = {
    ...message,
    content: [{ type: "toolCall" as const, id: "call", name: "read", arguments: { path: "file" } }],
  };
  const updated = updateTools(initial, { type: "message_start", message: completed });

  expect(updated.call?.args).toEqual({ path: "file" });
  expect(initial.call?.args).toEqual({});

  for (const status of ["running", "success", "error"] as const) {
    const tools = { call: { ...updated.call!, status } };

    expect(updateTools(tools, { type: "message_end", message: completed }).call?.status).toBe(
      status,
    );
  }
});

test("tool end and message end replace one card, preserving arguments", () => {
  const result: Extract<Message, { role: "toolResult" }> = {
    role: "toolResult",
    toolCallId: "call",
    toolName: "read",
    content: [{ type: "text", text: "ok" }],
    isError: false,
    timestamp: 0,
  };
  const started = updateTools(
    {},
    {
      type: "tool_execution_start",
      toolCallId: "call",
      toolName: "read",
      args: { path: "config" },
    },
  );
  const ended = updateTools(started, {
    type: "tool_execution_end",
    toolCallId: "call",
    toolName: "read",
    result,
    isError: false,
  });
  const completed = updateTools(ended, { type: "message_end", message: result });

  expect(Object.keys(completed)).toEqual(["call"]);
  expect(completed.call?.status).toBe("success");
  expect(completed.call?.args).toEqual({ path: "config" });
  expect(projectTools([{ ...result, isError: true }]).call?.status).toBe("error");
});
