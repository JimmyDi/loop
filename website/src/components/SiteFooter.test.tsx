import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { LanguageProvider } from "../i18n/LanguageProvider";
import { LanguageSwitch } from "./LanguageSwitch";
import { SiteFooter } from "./SiteFooter";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("keeps only copyright and legal actions, leaving the social slot empty", () => {
  const { container } = render(<SiteFooter />);
  const footer = container.querySelector("footer")!;
  expect(footer.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  expect(footer.firstElementChild?.textContent).toBe("");
  expect(footer.querySelectorAll("a,img,svg")).toHaveLength(0);
  expect(footer.textContent).toContain("开源 · MIT · © 2026 Loop 贡献者");
  const nav = within(screen.getByRole("navigation", { name: "页脚导航" }));
  expect(nav.getAllByRole("button")).toHaveLength(2);
  expect(nav.getByRole("button", { name: "隐私政策" })).toBeTruthy();
  expect(nav.getByRole("button", { name: "使用条款" })).toBeTruthy();
});

it("opens each notice locally, translates it and restores focus on dismissal", () => {
  vi.stubGlobal("navigator", { languages: ["zh-CN"], language: "zh-CN" });
  render(
    <LanguageProvider>
      <LanguageSwitch />
      <SiteFooter />
    </LanguageProvider>,
  );
  const privacy = screen.getByRole("button", { name: "隐私政策" });
  privacy.focus();
  fireEvent.click(privacy);
  expect(screen.getByRole("dialog", { name: "隐私政策" }).hasAttribute("open")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "关闭" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(privacy);
  fireEvent.click(screen.getByRole("button", { name: "使用条款" }));
  fireEvent.click(screen.getByRole("button", { name: "EN" }));
  const terms = screen.getByRole("dialog", { name: "Terms of Use" });
  expect(terms.textContent).not.toMatch(/[一-鿿]/u);
  expect(terms.textContent).toContain("brand asset policy");
  fireEvent(terms, new Event("cancel", { bubbles: true, cancelable: true }));
  expect(screen.queryByRole("dialog")).toBeNull();
});
