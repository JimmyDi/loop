import { expect, test } from "bun:test";

import { shouldSubmit } from "./composer-dom";

test("Enter submits except during composition or with Shift", () => {
  expect(shouldSubmit("Enter", false, false)).toBe(true);
  expect(shouldSubmit("Enter", true, false)).toBe(false);
  expect(shouldSubmit("Enter", false, true)).toBe(false);
  expect(shouldSubmit("a", false, false)).toBe(false);
});
