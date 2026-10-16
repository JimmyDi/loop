import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { initializeHeroPointer } from "./hero-pointer";

const bounds = (left: number, top: number, width: number, height: number): DOMRect =>
  new DOMRect(left, top, width, height);

let clock = 100;
let nextFrame = 0;
let callbacks = new Map<number, FrameRequestCallback>();
let media: Record<string, MediaQueryList>;
let host: HTMLElement;
let dispose = (): void => {};
const context = {
  clearRect: vi.fn(),
  setTransform: vi.fn(),
  fillText: vi.fn(),
  globalAlpha: 1,
};

beforeEach(() => {
  clock = 100;
  nextFrame = 0;
  callbacks = new Map();
  media = {};
  document.body.innerHTML =
    '<div class="hero-intro"><canvas class="hero-pointer"></canvas><h1><span data-pointer-clear>Loop</span></h1></div>';
  host = document.querySelector<HTMLElement>(".hero-intro")!;
  vi.spyOn(host, "getBoundingClientRect").mockReturnValue(bounds(0, 64, 800, 500));
  vi.spyOn(host.querySelector("h1 > span")!, "getBoundingClientRect").mockReturnValue(
    bounds(350, 264, 100, 60),
  );
  vi.spyOn(window, "matchMedia").mockImplementation((query) => {
    const result = Object.assign(new EventTarget(), {
      matches: !query.includes("reduced-motion"),
      media: query,
    }) as MediaQueryList;
    media[query] = result;
    return result;
  });
  vi.spyOn(window.performance, "now").mockImplementation(() => clock);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callbacks.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    callbacks.delete(id);
  });
});

afterEach(() => {
  dispose();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

const move = (x: number, y: number, pointerType = "mouse"): void => {
  host.dispatchEvent(new PointerEvent("pointermove", { clientX: x, clientY: y, pointerType }));
};

const paint = (time: number): void => {
  clock = time;
  const pending = Array.from(callbacks.values());
  callbacks.clear();
  pending.forEach((callback) => callback(time));
};

it("reveals a local trail without drawing over the heading and stops after fading", () => {
  dispose = initializeHeroPointer(host, host.querySelector<HTMLCanvasElement>("canvas")!);
  move(400, 250);
  expect(callbacks.size).toBe(1);
  paint(200);
  expect(context.fillText).toHaveBeenCalled();
  for (const [, x, y] of context.fillText.mock.calls) {
    expect(x > 336 && x < 464 && y > 188 && y < 272).toBe(false);
  }
  expect(callbacks.size).toBe(1);
  context.fillText.mockClear();
  paint(2100);
  expect(context.fillText).not.toHaveBeenCalled();
  expect(callbacks.size).toBe(0);
});

it("ignores touch events and limits drawing during rapid mouse input", () => {
  dispose = initializeHeroPointer(host, host.querySelector<HTMLCanvasElement>("canvas")!);
  move(100, 180, "touch");
  expect(callbacks.size).toBe(0);
  move(100, 180);
  move(700, 180);
  paint(200);
  expect(context.fillText.mock.calls.every(([, x]) => x < 250)).toBe(true);
});

it("draws below the intro beside the preview and keeps the preview clear", () => {
  vi.mocked(host.getBoundingClientRect).mockReturnValue(bounds(0, 64, 800, 1200));
  const preview = document.createElement("div");
  preview.setAttribute("data-pointer-clear", "");
  host.append(preview);
  vi.spyOn(preview, "getBoundingClientRect").mockReturnValue(bounds(200, 564, 550, 700));
  dispose = initializeHeroPointer(host, host.querySelector<HTMLCanvasElement>("canvas")!);
  move(175, 900);
  paint(200);
  expect(context.fillText.mock.calls.some(([, , y]) => y > 500)).toBe(true);
  for (const [, x, y] of context.fillText.mock.calls) {
    expect(x > 186 && x < 764 && y > 488 && y < 1212).toBe(false);
  }
});

it("clears immediately when reduced motion changes and resumes when allowed", () => {
  dispose = initializeHeroPointer(host, host.querySelector<HTMLCanvasElement>("canvas")!);
  move(100, 180);
  const preference = media["(prefers-reduced-motion: reduce)"];
  Object.assign(preference, { matches: true });
  preference.dispatchEvent(new Event("change"));
  expect(callbacks.size).toBe(0);
  move(200, 180);
  expect(callbacks.size).toBe(0);
  Object.assign(preference, { matches: false });
  preference.dispatchEvent(new Event("change"));
  move(200, 180);
  expect(callbacks.size).toBe(1);
});

it("clears pending frames when hidden, resized or disposed", () => {
  dispose = initializeHeroPointer(host, host.querySelector<HTMLCanvasElement>("canvas")!);
  move(100, 180);
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  document.dispatchEvent(new Event("visibilitychange"));
  expect(callbacks.size).toBe(0);
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  document.dispatchEvent(new Event("visibilitychange"));
  move(100, 180);
  window.dispatchEvent(new Event("resize"));
  expect(callbacks.size).toBe(0);
  move(100, 180);
  dispose();
  move(100, 180);
  expect(callbacks.size).toBe(0);
});

it("keeps the page usable when canvas rendering is unavailable", () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  dispose = initializeHeroPointer(host, host.querySelector<HTMLCanvasElement>("canvas")!);
  move(100, 180);
  paint(200);
  expect(context.fillText).not.toHaveBeenCalled();
  expect(callbacks.size).toBe(0);
});
