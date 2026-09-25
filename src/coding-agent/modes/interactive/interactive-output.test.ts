import { expect, test } from "bun:test";
import type { AssistantMessage } from "@earendil-works/pi-ai";

import { InteractiveOutput } from "./interactive-output";

function answer(content: AssistantMessage["content"]): AssistantMessage {
  return {
    role: "assistant",
    content,
    api: "openai-completions",
    provider: "test",
    model: "test",
    stopReason: "stop",
    timestamp: 1,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
  };
}

test("reports waiting before any stream event and thinking without exposing reasoning", () => {
  const chunks: string[] = [];
  const output = new InteractiveOutput((text) => chunks.push(text));
  const message = answer([{ type: "thinking", thinking: "internal reasoning" }]);

  output.start();
  expect(chunks).toEqual(["[Waiting for model… (/abort to cancel)]\n"]);
  output.handle({ type: "message_start", message });
  output.handle({
    type: "message_update",
    message,
    assistantMessageEvent: {
      type: "thinking_delta",
      contentIndex: 0,
      delta: "internal reasoning",
      partial: message,
    },
  });
  output.handle({
    type: "message_update",
    message,
    assistantMessageEvent: {
      type: "thinking_delta",
      contentIndex: 0,
      delta: "more reasoning",
      partial: message,
    },
  });

  expect(chunks).toEqual([
    "[Waiting for model… (/abort to cancel)]\n",
    "[Thinking… (/abort to cancel)]\n",
  ]);
});

test("renders final-only text and missing suffixes without duplicating streamed blocks", () => {
  const chunks: string[] = [];
  const output = new InteractiveOutput((text) => chunks.push(text));
  const message = answer([
    { type: "text", text: "Hello world" },
    { type: "text", text: "!" },
  ]);

  output.handle({ type: "message_start", message });
  output.handle({
    type: "message_update",
    message,
    assistantMessageEvent: {
      type: "text_delta",
      contentIndex: 0,
      delta: "Hello",
      partial: message,
    },
  });
  expect(chunks.at(-1)).toBe("Hello");
  output.handle({ type: "message_end", message });

  const finalOnly = answer([{ type: "text", text: "Final only" }]);

  output.handle({ type: "message_start", message: finalOnly });
  output.handle({ type: "message_end", message: finalOnly });
  output.handle({ type: "agent_settled" });

  expect(chunks.join("")).toBe(
    "[Waiting for model… (/abort to cancel)]\nHello world!\n" +
      "[Waiting for model… (/abort to cancel)]\nFinal only\n",
  );
});

test("shows tool activity and resets output after cancellation", () => {
  const chunks: string[] = [];
  const output = new InteractiveOutput((text) => chunks.push(text));
  const message = answer([{ type: "text", text: "Partial" }]);

  output.start();
  output.handle({
    type: "tool_execution_start",
    toolCallId: "read-1",
    toolName: "read",
    args: { path: "package.json" },
  });
  output.handle({
    type: "tool_execution_end",
    toolCallId: "read-1",
    toolName: "read",
    isError: false,
    result: {
      role: "toolResult",
      toolCallId: "read-1",
      toolName: "read",
      content: [],
      isError: false,
      timestamp: 1,
    },
  });
  output.handle({ type: "message_start", message });
  output.handle({
    type: "message_update",
    message,
    assistantMessageEvent: {
      type: "text_delta",
      contentIndex: 0,
      delta: "Partial",
      partial: message,
    },
  });
  output.handle({ type: "agent_settled" });
  output.finish();
  output.start();
  output.handle({ type: "message_start", message });
  output.handle({ type: "message_end", message });

  expect(chunks.join("")).toBe(
    "[Waiting for model… (/abort to cancel)]\n" +
      "[Executing read… (/abort to cancel)]\n[read completed]\n" +
      "[Waiting for model… (/abort to cancel)]\nPartial\n" +
      "[Waiting for model… (/abort to cancel)]\nPartial\n",
  );
});
