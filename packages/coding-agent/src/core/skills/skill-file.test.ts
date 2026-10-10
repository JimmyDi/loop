import { expect, test } from "vitest";

import { parseSkill, MAX_SKILL_BYTES, renderLoadedSkill } from "./skill-file";

test("wraps instructions with escaped source attributes and preserves Markdown body", () => {
  const result = renderLoadedSkill({
    name: "review",
    path: 'skills/a"&b/SKILL.md',
    content: "Compare a < b and `code`.",
  });
  expect(result).toContain('<skill name="review" location="skills/a&quot;&amp;b/SKILL.md">');
  expect(result).toContain("Compare a < b and `code`.");
  expect(result).toContain("do not grant tool permissions");
  expect(result.endsWith("</skill>")).toBe(true);
});

test("requires bounded, unambiguous metadata and explicit invocation policy", () => {
  const main =
    "---\nname: example\ndescription: |\n  Review code\n  carefully\ndisable-model-invocation: true\n---\nRead the source.";
  expect(parseSkill(main)).toEqual({
    name: "example",
    description: "Review code carefully",
    modelInvocable: false,
    content: "Read the source.",
  });
  for (const invalid of [
    "body",
    main.replace("name: example", "name: example\nname: other"),
    main.replace("name: example", "name: ../example"),
    main.replace("true", '"true"'),
    main.replace("Read the source.", ""),
    "x".repeat(MAX_SKILL_BYTES + 1),
    main + "\0",
  ])
    expect(() => parseSkill(invalid)).toThrow();
});
