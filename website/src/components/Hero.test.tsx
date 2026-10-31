import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { initializeHeroPointer } from "../hero-pointer";
import { translations } from "../translations";
import { Hero } from "./Hero";

vi.mock("../hero-pointer", () => ({ initializeHeroPointer: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("preserves the main heading and startup command without the source link", () => {
  const { container } = render(<Hero />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("从想法，到实现。");
  expect(screen.getByText("npx @loop-harness/loop web").tagName).toBe("CODE");
  expect(screen.getByRole("button", { name: "复制启动命令" }).textContent).toBe("复制");
  expect(screen.queryByRole("link", { name: "探索源码" })).toBeNull();
  expect(container.querySelector("canvas")?.getAttribute("aria-hidden")).toBe("true");
  expect(container.querySelector("h1")?.previousElementSibling).toBeNull();
});

it("extends the pointer host through the preview while protecting the product content", () => {
  const { container } = render(<Hero />);
  const section = container.querySelector("section")!;
  const canvas = section.querySelector("canvas");
  const preview = screen.getByLabelText(translations.zh.previewLabel);
  expect(initializeHeroPointer).toHaveBeenCalledWith(section, canvas);
  expect(section.contains(preview)).toBe(true);
  expect(preview.hasAttribute("data-pointer-clear")).toBe(true);
});
