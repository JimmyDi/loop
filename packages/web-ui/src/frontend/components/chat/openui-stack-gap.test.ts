import { expect, test } from "vitest";

import { normalizeOpenUiStackGap } from "./openui-stack-gap";

test("recovers a positional Stack gap for named reference lists", () => {
  expect(normalizeOpenUiStackGap('root = Stack([map, card], gap="m")')).toBe(
    'root = Stack([map, card], null, "m")',
  );
});

test.each([
  'root = Stack([map], "row", "m")',
  'root = Stack([map], gap="unknown")',
  'root = Stack([map], direction="row", gap="m")',
  'text = "First line\nroot = Stack([map], gap=\\"m\\")\nLast line"',
  '// root = Stack([map], gap="m")',
])("preserves source outside the recognized form: %s", (source) => {
  expect(normalizeOpenUiStackGap(source)).toBe(source);
});
