import { expect, it } from "vitest";

import { browserLanguage } from "./language";

it.each(["zh", "zh-CN", "zh-TW", "zh-Hant", "ZH-hk"])("uses Chinese for %s", (locale) => {
  expect(browserLanguage([locale])).toBe("zh");
});
it.each([[], ["en-US"], ["fr-FR", "zh-CN"], ["zhx"]].map((languages) => ({ languages })))(
  "uses English when the first preference is not Chinese: %j",
  ({ languages }) => {
    expect(browserLanguage(languages)).toBe("en");
  },
);
