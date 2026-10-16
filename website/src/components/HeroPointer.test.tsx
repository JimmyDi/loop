import { cleanup, render } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { initializeHeroPointer } from "../hero-pointer";
import { HeroPointer } from "./HeroPointer";

vi.mock("../hero-pointer", () => ({ initializeHeroPointer: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("binds the decoration to its own host and cleans up on unmount", () => {
  const hostRef = createRef<HTMLElement>();
  const dispose = vi.fn();
  hostRef.current = document.createElement("div");
  vi.mocked(initializeHeroPointer).mockReturnValue(dispose);
  const { container, unmount } = render(<HeroPointer hostRef={hostRef} />);
  const canvas = container.querySelector("canvas");
  expect(initializeHeroPointer).toHaveBeenCalledWith(hostRef.current, canvas);
  expect(canvas?.getAttribute("aria-hidden")).toBe("true");
  unmount();
  expect(dispose).toHaveBeenCalledOnce();
});
