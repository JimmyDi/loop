import { expect, test } from "vitest";

import { fitSkillScopes } from "./skill-scope-layout";

test("fit scope tabs reserves overflow space and promotes a selected hidden project", () => {
  expect(fitSkillScopes(300, [80, 60, 70, 60], 36, 0, 4)).toEqual([0, 1, 2, 3]);
  expect(fitSkillScopes(232, [80, 60, 70, 60], 36, 0, 4)).toEqual([0, 1]);
  expect(fitSkillScopes(252, [80, 60, 70, 60], 36, 3, 4)).toEqual([0, 1, 3]);
  expect(fitSkillScopes(190, [80, 60, 70, 60], 36, 3, 4)).toEqual([0, 3]);
  expect(fitSkillScopes(140, [80, 60, 70, 60], 36, 3, 4)).toEqual([0]);
  expect(fitSkillScopes(80, [80, 60], 36, 0, 4)).toEqual([0]);
  expect(fitSkillScopes(80, [80], 36, 0, 4)).toEqual([0]);
});
