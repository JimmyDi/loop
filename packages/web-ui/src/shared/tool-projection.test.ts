import { expect, test } from "vitest";

import type { Message } from "./protocol";
import { projectTools, updateTools } from "./tool-projection";

test("MCP display labels survive execution updates and restored messages without rewriting names", () => {
  const started = updateTools(
    {},
    {
      type: "tool_execution_start",
      toolCallId: "mcp-call",
      toolName: "mcp_internal_hash",
      toolDisplayName: "Example · list_directory",
      args: { path: "test" },
    },
  );
  expect(started["mcp-call"]).toMatchObject({
    name: "mcp_internal_hash",
    displayName: "Example · list_directory",
    status: "running",
  });
  const result: Extract<Message, { role: "toolResult" }> = {
    role: "toolResult",
    toolCallId: "mcp-call",
    toolName: "mcp_internal_hash",
    content: [{ type: "text", text: "synthetic result" }],
    timestamp: 0,
    isError: false,
    details: { loopDisplayName: "Example · list_directory" },
  };
  const ended = updateTools(started, { type: "message_end", message: result });
  expect(ended["mcp-call"]).toMatchObject({
    displayName: "Example · list_directory",
    args: { path: "test" },
  });
  expect(projectTools([result])["mcp-call"]).toMatchObject({
    name: "mcp_internal_hash",
    displayName: "Example · list_directory",
    status: "success",
  });
  expect(
    projectTools([{ ...result, details: undefined }])["mcp-call"]!.displayName,
  ).toBeUndefined();
});

test.each([null, false, 1, "synthetic details", ["synthetic details"]])(
  "non-object JSON details do not supply display labels (%j)",
  (details) => {
    const result: Extract<Message, { role: "toolResult" }> = {
      role: "toolResult",
      toolCallId: "call",
      toolName: "example",
      content: [],
      timestamp: 0,
      isError: false,
      details,
    };
    expect(projectTools([result]).call).toMatchObject({ name: "example", status: "success" });
    expect(projectTools([result]).call?.displayName).toBeUndefined();
  },
);

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
