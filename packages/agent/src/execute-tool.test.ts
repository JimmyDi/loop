import { Type } from "@earendil-works/pi-ai";
import type { ToolCall } from "@earendil-works/pi-ai";
import { expect, test, vi } from "vitest";

import { executeTool } from "./execute-tool";
import type { AgentTool } from "./types";

test("invalid arguments never execute and valid calls preserve result identity and native content", async () => {
  const content = [{ type: "image" as const, data: "AAAA", mimeType: "image/png" }];
  const execute = vi.fn(() => content);
  const tool: AgentTool = {
    name: "echo",
    description: "Echo",
    parameters: Type.Object({ text: Type.String() }),
    execute,
  };
  const signal = new AbortController().signal;
  const call: ToolCall = { type: "toolCall", id: "first", name: "echo", arguments: {} };
  expect(await executeTool(call, [tool], signal)).toMatchObject({
    toolCallId: "first",
    toolName: "echo",
    isError: true,
  });
  expect(execute).not.toHaveBeenCalled();
  const valid = { ...call, arguments: { text: "hello" } };
  expect(await executeTool(valid, [tool], signal)).toMatchObject({
    role: "toolResult",
    toolCallId: "first",
    toolName: "echo",
    content,
    isError: false,
  });
  expect(execute).toHaveBeenCalledWith({ text: "hello" }, signal);
});

test("cancellation wins over a concurrent tool failure and prevents pre-aborted execution", async () => {
  const controller = new AbortController();
  const execute = vi.fn(() => {
    controller.abort(new Error("Run cancelled"));
    throw new Error("Tool failed");
  });
  const tool: AgentTool = {
    name: "echo",
    description: "Echo",
    parameters: Type.Object({}),
    execute,
  };
  const call: ToolCall = { type: "toolCall", id: "first", name: "echo", arguments: {} };
  const result = await executeTool(call, [tool], controller.signal);
  expect(result).toMatchObject({
    isError: true,
    content: [{ type: "text", text: "Run cancelled" }],
  });
  expect(await executeTool(call, [tool], controller.signal)).toMatchObject({
    toolCallId: result.toolCallId,
    isError: true,
    content: result.content,
  });
  expect(execute).toHaveBeenCalledTimes(1);
});
