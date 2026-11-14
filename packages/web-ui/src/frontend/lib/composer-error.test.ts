import { expect, test } from "vitest";

import { composerError } from "./composer-error";

test("composer shows the first actionable error", () => {
  const error = new Error("Mode update failed");
  expect(composerError([undefined, error])).toBe(error);
});
