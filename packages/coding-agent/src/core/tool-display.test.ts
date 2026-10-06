import { expect, test } from "vitest";
import type { ToolResultMessage } from "@earendil-works/pi-ai";

import { withToolDisplayName } from "./tool-display";

test("display metadata retains exact tool identity, content and the original historical label", () => {
  const message: ToolResultMessage = {
    role: "toolResult",
    toolCallId: "call",
    toolName: "mcp_internal_hash",
    content: [{ type: "text", text: "synthetic result" }],
    isError: true,
    timestamp: 0,
    details: { example: true },
  };
  const names = new Map([[message.toolName, "Example · list_directory"]]);
  const projected = withToolDisplayName(message, names);
  expect(projected).toEqual({
    ...message,
    details: { example: true, loopDisplayName: "Example · list_directory" },
  });
  expect(message.details).toEqual({ example: true });
  expect(
    withToolDisplayName(projected, new Map([[message.toolName, "Renamed · list_directory"]])),
  ).toEqual(projected);
  expect(withToolDisplayName(message, new Map())).toEqual(message);
});
