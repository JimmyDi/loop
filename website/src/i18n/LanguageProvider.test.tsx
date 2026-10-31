import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

import { LanguageSwitch } from "../components/LanguageSwitch";
import { translations } from "../translations";
import { LanguageProvider } from "./LanguageProvider";
import { useLanguage } from "./useLanguage";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("uses the browser language in the first render without an effect-driven switch", () => {
  vi.stubGlobal("navigator", { languages: ["en-US"], language: "en-US" });
  const Copy = () => <p>{useLanguage().t("heroFirst")}</p>;
  expect(
    renderToString(
      <LanguageProvider>
        <Copy />
      </LanguageProvider>,
    ),
  ).toContain("From idea,");
  expect(
    renderToString(
      <LanguageProvider initialLanguage="zh">
        <Copy />
      </LanguageProvider>,
    ),
  ).toContain("从想法，");
});

it("updates metadata and restarts from browser preference on remount", () => {
  document.head.innerHTML =
    '<title></title><meta name="description" /><meta property="og:title" /><meta property="og:description" />';
  vi.stubGlobal("navigator", { languages: ["en-GB", "zh-CN"], language: "en-GB" });
  const page = (
    <LanguageProvider>
      <LanguageSwitch />
    </LanguageProvider>
  );
  const { unmount } = render(page);
  expect(document.title).toBe(translations.en.title);
  expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(
    translations.en.description,
  );
  fireEvent.click(screen.getByRole("button", { name: "中文" }));
  expect(document.querySelector('meta[property="og:title"]')?.getAttribute("content")).toBe(
    translations.zh.title,
  );
  expect(document.querySelector('meta[property="og:description"]')?.getAttribute("content")).toBe(
    translations.zh.socialDescription,
  );
  unmount();
  render(page);
  expect(document.documentElement.lang).toBe("en");
});
