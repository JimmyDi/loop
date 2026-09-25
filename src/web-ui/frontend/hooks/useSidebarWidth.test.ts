import { expect, test } from "bun:test";

import { clampWidth } from "./useSidebarWidth";

test("sidebar width remains in the usable range even for corrupt preferences", () => {
  expect(clampWidth(150)).toBe(260);
  expect(clampWidth(1000)).toBe(420);
  expect(clampWidth(Number.NaN)).toBe(260);
  expect(clampWidth(320)).toBe(320);
});
