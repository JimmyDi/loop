import { afterEach, expect, it, vi } from "vitest";

import { languageBootstrap, render } from "../prerender";
import { translations } from "../translations";

afterEach(() => {
  document.body.innerHTML = "";
  delete document.documentElement.dataset.languagePending;
  vi.unstubAllGlobals();
});

it.each([
  { languages: ["en-US", "zh-CN"], language: "en" },
  { languages: ["zh-Hant", "en-US"], language: "zh" },
  { languages: ["fr-FR"], language: "en" },
  { languages: [], language: "en" },
] as const)(
  "selects $language markup before hydration for $languages",
  ({ languages, language }) => {
    vi.stubGlobal("navigator", { languages, language: "en-GB" });
    document.documentElement.dataset.languagePending = "true";
    document.head.innerHTML =
      '<title></title><meta name="description" /><meta property="og:title" /><meta property="og:description" />';
    document.body.innerHTML =
      `<div id="root">${render("/loop/", "zh")}</div>` +
      `<template id="initial-english">${render("/loop/", "en")}</template>`;
    // Execute the exact self-contained script written to the production HTML.
    new Function(languageBootstrap())();
    const root = document.getElementById("root")!;
    expect(root.dataset.language).toBe(language);
    expect(root.querySelector("h1")?.textContent).toContain(
      language === "zh" ? "实现。" : "reality.",
    );
    expect(document.getElementById("initial-english")).toBeNull();
    expect(document.title).toBe(translations[language].title);
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(
      translations[language].description,
    );
    expect(document.documentElement.dataset.languagePending).toBeUndefined();
    expect(root.querySelector('img[src*="product/storefront-"]')?.getAttribute("src")).toContain(
      `/loop/product/storefront-filters-${language}-light.webp`,
    );
  },
);
