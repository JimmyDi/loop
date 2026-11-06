import { expect, test } from "vitest";

import type { Message } from "./protocol";
import { timelinePreviews } from "./timeline-navigation";
import { fileContent } from "./prompt-files";

test("previews preserve absolute positions and exclude thinking, tools and commentary", () => {
  const assistant = (text: string): Message => ({
    role: "assistant",
    content: [{ type: "text", text }],
    api: "openai-completions",
    provider: "test",
    model: "test",
    stopReason: "stop",
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
  const commentary = assistant("Hidden update");
  if (commentary.role === "assistant" && commentary.content[0]?.type === "text")
    commentary.content[0].textSignature = JSON.stringify({
      v: 1,
      id: "example",
      phase: "commentary",
    });
  const result = timelinePreviews(
    [
      { role: "user", content: "Request", timestamp: 0 },
      commentary,
      assistant("Reply\nSecond line"),
      { role: "user", content: [], timestamp: 1 },
      assistant("x".repeat(800)),
    ],
    20,
  );
  expect(result[0]).toEqual({ index: 20, user: "Request", reply: "Reply\nSecond line" });
  expect(result[1]?.index).toBe(23);
  expect(result[1]?.reply).toHaveLength(601);
  expect(result[1]?.reply.endsWith("…")).toBe(true);
  expect(
    timelinePreviews([
      {
        role: "user",
        timestamp: 0,
        content: [
          { type: "text", text: fileContent({ name: "example.txt", text: "Attachment payload" }) },
        ],
      },
    ])[0]?.user,
  ).toBe("");
});
