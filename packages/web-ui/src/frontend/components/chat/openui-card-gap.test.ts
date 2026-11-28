import { expect, test } from "vitest";

import { normalizeOpenUiCardGap } from "./openui-card-gap";

test("inserts the optional direction in nested Card calls with a literal gap", () => {
  expect(
    normalizeOpenUiCardGap('root = Card([Stack([Card(items, "sunk", "xs")])], null, "s")'),
  ).toBe('root = Card([Stack([Card(items, "sunk", null, "xs")])], null, null, "s")');
});

test.each([
  'root = Card(items, "card", "row", "s")',
  'root = Card(items, "sunk", "unknown")',
  'root = Card(items, variant, "s")',
  'root = Card(items, "card", "s", "center")',
  'root = OtherCard(items, "card", "s")',
  '// root = Card(items, "card", "s")',
  'text = "Card(items, \\"sunk\\", \\"xs\\")"',
])("preserves source outside the recognized form: %s", (source) => {
  expect(normalizeOpenUiCardGap(source)).toBe(source);
});
