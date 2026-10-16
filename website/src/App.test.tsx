import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { App } from "./App";
import { LanguageProvider } from "./i18n/LanguageProvider";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("translates the complete page without resetting the selected interface or removing commands", () => {
  vi.stubGlobal("navigator", { languages: ["zh-CN"], language: "zh-CN" });
  const { container } = render(
    <LanguageProvider>
      <App />
    </LanguageProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /CLI/ }));
  fireEvent.click(screen.getByRole("button", { name: "EN" }));
  const body = container.cloneNode(true) as HTMLElement;
  body.querySelector('[lang="zh-CN"]')?.remove();
  expect(body.textContent).not.toMatch(/[一-鿿]/u);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("reality.");
  expect(container.querySelector<HTMLElement>("#panel-cli")?.hidden).toBe(false);
  expect(screen.getAllByRole("button", { name: "Copy startup command" })).toHaveLength(1);
  expect(container.querySelector("#start")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "中文" }));
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("实现。");
  for (const link of container.querySelectorAll<HTMLAnchorElement>('a[href^="https://"]')) {
    expect(link.target).toBe("_blank");
    expect(link.rel).toBe("noopener noreferrer");
  }
});
