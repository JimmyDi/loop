import { expect, test } from "vitest";
import type { AssistantMessage } from "@earendil-works/pi-ai";

import { stoppedResponse } from "./stopped-response";

test("stopped snapshots preserve visible text without thinking or unfinished tool calls", () => {
  const draft = {
    role: "assistant",
    content: [
      { type: "text", text: "Partial text" },
      { type: "thinking", thinking: "Hidden" },
      { type: "toolCall", id: "call", name: "read", arguments: {} },
    ],
    stopReason: "stop",
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
  } satisfies AssistantMessage;
  expect(stoppedResponse(draft)).toMatchObject({
    content: [{ type: "text", text: "Partial text" }],
    stopReason: "aborted",
  });
  expect(draft.content).toHaveLength(3);
  expect(stoppedResponse({ ...draft, content: [] })).toBeUndefined();
});
