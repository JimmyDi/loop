import { expect, test } from "vitest";

import { ApiError } from "./api";
import { isNothingToCompact } from "./compaction-notice";

test("only the exact no-work notice is informational", () => {
  expect(isNothingToCompact(new ApiError("nothing_to_compact", "Notice", 400))).toBe(true);
  expect(isNothingToCompact("Nothing to compact")).toBe(true);
  for (const error of [undefined, "Summary unavailable", new ApiError("operation_failed", "", 500)])
    expect(isNothingToCompact(error)).toBe(false);
});
