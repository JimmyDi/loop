import { expect, test } from "vitest";

import { resolveSkillSelection } from "./selection";
import type { SkillManager } from "./skill-manager";

test("direct mentions resolve exact identities; attachments cannot select workflows", async () => {
  const manager = {
    refresh: async () => {},
    view: () => ({
      skills: [
        { id: "first", name: "example" },
        { id: "second", name: "example" },
      ],
    }),
  } as unknown as SkillManager;
  await expect(resolveSkillSelection(manager, ".", "Use $example", [])).rejects.toThrow(
    "Several skills",
  );
  expect(await resolveSkillSelection(manager, ".", "Use $example", ["second"])).toEqual(["second"]);
  expect(
    await resolveSkillSelection(manager, ".", [{ type: "text", text: "Reference: $example" }], []),
  ).toEqual([]);
});
