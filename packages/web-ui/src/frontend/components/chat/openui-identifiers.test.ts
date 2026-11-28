import { expect, test } from "vitest";

import { normalizeOpenUiIdentifiers } from "./openui-identifiers";

test("aliases declared Unicode bindings without changing strings, comments or data fields", () => {
  const lines = [
    "root = Stack([résumé, 图表])",
    'résumé = TextContent("résumé")',
    "图表 = TextContent(data.图表)",
    "// 图表",
    'loop_identifier_0 = {图表: "x"}',
  ];
  expect(normalizeOpenUiIdentifiers(lines.join("\n"))).toBe(
    [
      "root = Stack([loop_identifier_1, loop_identifier_2])",
      'loop_identifier_1 = TextContent("résumé")',
      "loop_identifier_2 = TextContent(data.图表)",
      ...lines.slice(3),
    ].join("\n"),
  );
});
