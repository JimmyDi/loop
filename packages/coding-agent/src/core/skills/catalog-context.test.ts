import { expect, test } from "vitest";

import { renderSkillCatalog } from "./catalog-context";
import { estimateTextTokens } from "../context-budget";
import type { SkillSummary } from "./types";
import { renderSystemPromptSection } from "../system-prompt";

test("bounds catalog tokens and excludes disabled and manual skills", () => {
  const skills: SkillSummary[] = Array.from({ length: 100 }, (_, index) => ({
    id: String(index),
    name: "example",
    handle: "example-" + index,
    path: "SKILL.md",
    description: "阅读<代码> & 检查实现。".repeat(30),
    enabled: index !== 0,
    modelInvocable: index !== 1,
    managed: false,
    scope: "personal",
    source: { kind: "discovered" },
  }));
  const result = renderSkillCatalog(skills, 32000);
  expect(
    estimateTextTokens(renderSystemPromptSection("skills", result.content)),
  ).toBeLessThanOrEqual(640);
  expect(result.omitted).toBeGreaterThan(0);
  expect(result.content).not.toContain("- example-0 (");
  expect(result.content).not.toContain("- example-1 (");
});
