import { expect, test, vi } from "vitest";
import type { AssistantMessage, Message, ToolCall } from "@earendil-works/pi-ai";
import { getModel } from "@earendil-works/pi-ai/compat";
import { transformMessages } from "@earendil-works/pi-ai/api/transform-messages";

import { normalizeModelInput } from "./normalize-model-input";

const model = getModel("anthropic", "claude-opus-4-5");

const answer = (
  calls: ToolCall[] = [],
  stopReason: AssistantMessage["stopReason"] = calls.length ? "toolUse" : "stop",
): AssistantMessage => {
  return {
    role: "assistant",
    content: calls.length ? calls : [{ type: "text", text: "answer" }],
    model: model.id,
    provider: model.provider,
    api: model.api,
    stopReason,
    timestamp: 1,
    usage: {
      input: 1,
      output: 1,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 2,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
  };
};

const call = (
  id: string,
  name = "echo",
  args: Record<string, unknown> = { text: id },
): ToolCall => {
  return { type: "toolCall", id, name, arguments: args };
};

test.each([false, true])(
  "normalization carries raw origins through filtering, repairs and model switching (%s)",
  async (switchModel) => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(100);
    const selected = switchModel ? { ...model, id: "other", input: ["text" as const] } : model;
    const user: Message = { role: "user", content: "Same", timestamp: 1 };
    const history: Message[] = [
      user,
      answer([call("failed")], "error"),
      answer([], "aborted"),
      {
        ...answer([call("first"), call("missing")]),
        content: [
          { type: "thinking", thinking: "", redacted: true, thinkingSignature: "opaque-fixture" },
          { type: "thinking", thinking: "Plan", thinkingSignature: "fixture" },
          { type: "text", text: "Work", textSignature: "fixture" },
          { ...call("first"), thoughtSignature: "fixture" },
          call("missing"),
        ],
      },
      {
        role: "toolResult",
        toolCallId: "first",
        toolName: "echo",
        isError: false,
        timestamp: 1,
        content: [{ type: "image", data: "AAAA", mimeType: "image/png" }],
      },
      answer([call("missing")]),
      structuredClone(user),
    ];
    const original = structuredClone(history);
    try {
      const captured = normalizeModelInput(history, selected);
      expect(captured.messages).toEqual(transformMessages(structuredClone(original), selected));
      expect(captured.sources).toEqual([
        { type: "history", messageIndex: 0 },
        { type: "history", messageIndex: 3 },
        { type: "history", messageIndex: 4 },
        { type: "tool-repair", messageIndex: 3, toolCallId: "missing" },
        { type: "history", messageIndex: 5 },
        { type: "tool-repair", messageIndex: 5, toolCallId: "missing" },
        { type: "history", messageIndex: 6 },
      ]);
      expect(history.slice(0, original.length)).toEqual(original);
      expect(
        captured.messages.every((message) => Object.getOwnPropertySymbols(message).length === 0),
      ).toBe(true);
      captured.messages[0]!.content = "Changed";
      expect(history[0]).toEqual(original[0]);
    } finally {
      clock.mockRestore();
    }
  },
);
