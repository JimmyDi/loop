import { expect, it, vi } from "vitest";

import { createPointerField } from "./hero-pointer-field";

it("bounds a long trail and discards old cells before drawing", () => {
  const field = createPointerField();
  for (let x = 100; x < 2400; x += 150) field.add(x, 200, 100, 2500, 500, []);
  const context = { fillText: vi.fn(), globalAlpha: 1 };
  field.paint(context as unknown as CanvasRenderingContext2D, 200);
  expect(context.fillText.mock.calls.length).toBeLessThanOrEqual(850);
  expect(field.active()).toBe(true);
  context.fillText.mockClear();
  field.paint(context as unknown as CanvasRenderingContext2D, 2100);
  expect(context.fillText).not.toHaveBeenCalled();
  expect(field.active()).toBe(false);
});
