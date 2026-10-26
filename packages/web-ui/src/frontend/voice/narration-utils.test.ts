import { expect, test } from "vitest";

import type { SessionSnapshot } from "../../shared/protocol";
import { voiceNarration } from "./narration-utils";

test("narration uses completed replies and real tool outcomes while omitting code", () => {
  const snapshot = {
    state: {
      messages: [
        {
          role: "assistant",
          content: [{ type: "text", text: "Done.\n```ts\nsecret();\n```" }],
          timestamp: 1,
          stopReason: "stop",
        },
        {
          role: "assistant",
          content: [{ type: "text", text: "Interrupted" }],
          timestamp: 2,
          stopReason: "aborted",
        },
      ],
      draft: { role: "assistant", content: [{ type: "text", text: "unfinished" }] },
    },
    tools: { a: { id: "a", name: "bash", status: "error" } },
  } as unknown as SessionSnapshot;
  const rows = voiceNarration(snapshot);
  expect(rows.map((row) => row.kind)).toEqual(["reply", "toolError"]);
  expect(rows[0]?.text).toBe("Done.");
  expect(rows[1]?.text).toBe("bash");
});

test("long results narrate at most two short sentences and refer details to the screen", () => {
  const snapshot = {
    state: {
      messages: [
        {
          role: "assistant",
          timestamp: 1,
          stopReason: "stop",
          content: [
            { type: "text", text: "完成了。测试通过。后续说明。" + "很长的详情".repeat(50) },
          ],
        },
      ],
    },
    tools: {},
  } as unknown as SessionSnapshot;
  const rows = voiceNarration(snapshot);
  expect(rows.map((row) => row.kind)).toEqual(["reply", "reply", "details"]);
  expect(rows.every((row) => row.text.length <= 110)).toBe(true);
});
