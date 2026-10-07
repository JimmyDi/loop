import { expect, test } from "vitest";

import { parseSkill, MAX_SKILL_BYTES } from "./skill-file";

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
