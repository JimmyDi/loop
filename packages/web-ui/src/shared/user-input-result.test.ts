import { expect, test } from "vitest";

import { userInputResult } from "./user-input-result";
import type { ToolView } from "./protocol";

test("malformed persisted question content never reaches the history component", () => {
  const tool: ToolView = {
    id: "t",
    name: "request_user_input",
    status: "success",
    result: {
      role: "toolResult",
      toolCallId: "t",
      toolName: "request_user_input",
      timestamp: 1,
      isError: false,
      content: [
        {
          type: "text",
          text: JSON.stringify({
            outcome: "answered",
            request: { questions: [{ id: "q", text: {} }] },
          }),
        },
      ],
    },
  };
  expect(userInputResult(tool)).toBeUndefined();
  tool.result!.content = [{ type: "text", text: "invalid json" }];
  expect(userInputResult(tool)).toBeUndefined();
});
