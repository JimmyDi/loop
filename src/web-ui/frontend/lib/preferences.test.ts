import { expect, test } from "bun:test";

import { readPreference, writePreference } from "./preferences";

test("missing browser storage is optional", () => {
  expect(readPreference("nonexistent-test-key", "fallback")).toBe("fallback");
  expect(() => writePreference("test-key", "value")).not.toThrow();
});
