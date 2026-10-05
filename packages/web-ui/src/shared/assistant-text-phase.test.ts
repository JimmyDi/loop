import { expect, test } from "vitest";

import { assistantTextPhase } from "./assistant-text-phase";

test("reads native phase metadata without interpreting opaque or unsupported signatures", () => {
  for (const phase of ["commentary", "final_answer"] as const) {
    expect(assistantTextPhase(JSON.stringify({ v: 1, id: "text", phase }))).toBe(phase);
  }
  for (const signature of [
    undefined,
    "opaque",
    "{bad",
    "null",
    '{"phase":"commentary"}',
    '{"v":2,"id":"text","phase":"commentary"}',
    '{"v":1,"id":false,"phase":"commentary"}',
    '{"v":1,"id":"text","phase":"unknown"}',
  ]) {
    expect(assistantTextPhase(signature)).toBeUndefined();
  }
});
