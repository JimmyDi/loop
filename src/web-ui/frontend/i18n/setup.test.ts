import { expect, test } from "bun:test";

import { en } from "./en";
import { zh } from "./zh";

test("English and Chinese cover identical nonempty interface and error keys", () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
  expect(Object.keys(en.errors).sort()).toEqual(Object.keys(zh.errors).sort());

  for (const resource of [en, zh]) {
    for (const value of [...Object.values(resource), ...Object.values(resource.errors)]) {
      if (typeof value === "string") expect(value.trim().length).toBeGreaterThan(0);
    }
  }
});
