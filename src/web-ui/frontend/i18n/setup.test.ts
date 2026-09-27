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

test("browser initialization does not persist until the user selects a language", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      "--eval",
      `
      import { expect } from "bun:test";
      const stored = new Map();
      Object.defineProperty(globalThis, "navigator", { value: { languages: ["zh-CN"] } });
      globalThis.document = { documentElement: { lang: "" } };
      globalThis.localStorage = {
        getItem: (key) => stored.get(key) ?? null,
        setItem: (key, value) => stored.set(key, value),
      };
      const { i18n } = await import("./setup.ts");
      expect(i18n.language).toBe("zh");
      expect(document.documentElement.lang).toBe("zh");
      expect(stored.size).toBe(0);
      await i18n.changeLanguage("en");
      expect(stored.get("loop.web.language")).toBe(JSON.stringify("en"));
      expect(document.documentElement.lang).toBe("en");
      globalThis.localStorage.setItem = () => { throw new Error("Storage unavailable"); };
      await i18n.changeLanguage("zh");
      expect(document.documentElement.lang).toBe("zh");
    `,
    ],
    { cwd: import.meta.dir },
  );

  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
});
