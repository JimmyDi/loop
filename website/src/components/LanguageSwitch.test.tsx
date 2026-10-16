import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { LanguageProvider } from "../i18n/LanguageProvider";
import { LanguageSwitch } from "./LanguageSwitch";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it.each([
  { browser: "en-US", selected: "en", label: "EN" },
  { browser: "zh-CN", selected: "zh", label: "中文" },
])(
  "initializes the capsule from $browser and keeps one language selected",
  ({ browser, selected, label }) => {
    vi.stubGlobal("navigator", { languages: [browser], language: browser });
    render(
      <LanguageProvider>
        <LanguageSwitch />
      </LanguageProvider>,
    );
    const capsule = screen.getByRole("group");
    const chinese = screen.getByRole("button", { name: "中文" });
    const english = screen.getByRole("button", { name: "EN" });
    expect(capsule.dataset.language).toBe(selected);
    expect(screen.getByRole("button", { name: label }).getAttribute("aria-pressed")).toBe("true");
    expect(capsule.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "中文" }));
    expect(capsule.dataset.language).toBe("zh");
    expect(chinese.getAttribute("aria-pressed")).toBe("true");
    expect(english.getAttribute("aria-pressed")).toBe("false");
    expect(document.documentElement.lang).toBe("zh-CN");
    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(capsule.dataset.language).toBe("en");
    expect(chinese.getAttribute("aria-pressed")).toBe("false");
    expect(english.getAttribute("aria-pressed")).toBe("true");
    expect(document.documentElement.lang).toBe("en");
  },
);
