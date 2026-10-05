import { expect, test } from "vitest";

import { getInitialLanguage, resolveLanguage } from "./language";

test.each([
  ["en", ["zh-CN"], "en"],
  ["zh", ["en-US"], "zh"],
  [null, ["zh-CN"], "zh"],
  [null, ["zh-TW"], "zh"],
  [null, ["ZH-Hant"], "zh"],
  [null, ["en-GB", "zh-CN"], "en"],
  [null, ["fr-FR", "zh-HK", "en-US"], "zh"],
  [null, ["de-DE"], "en"],
  [null, [], "en"],
  ["invalid", ["zh-CN"], "zh"],
  [42, ["zh-CN"], "zh"],
  [{ language: "en" }, ["zh-CN"], "zh"],
] as const)("resolve language: saved %j, browser %j → %s", (saved, languages, expected) => {
  expect(resolveLanguage(saved, languages)).toBe(expected);
});

test("initial language tolerates corrupt or unavailable storage and missing browser APIs", () => {
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  let saved: string | null = null;

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { languages: ["zh-CN"], language: "en-US" },
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => saved },
  });

  try {
    expect(getInitialLanguage()).toBe("zh");
    saved = "{invalid";
    expect(getInitialLanguage()).toBe("zh");
    saved = JSON.stringify("en");
    expect(getInitialLanguage()).toBe("en");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("Storage unavailable");
      },
    });
    expect(getInitialLanguage()).toBe("zh");
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { language: "zh-TW", languages: [] },
    });
    expect(getInitialLanguage()).toBe("zh");
    Reflect.deleteProperty(globalThis, "navigator");
    expect(getInitialLanguage()).toBe("en");
  } finally {
    if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
    else Reflect.deleteProperty(globalThis, "navigator");

    if (storageDescriptor) Object.defineProperty(globalThis, "localStorage", storageDescriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
