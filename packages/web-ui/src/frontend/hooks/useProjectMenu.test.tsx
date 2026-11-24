import { expect, test } from "vitest";
import { Window } from "happy-dom";

import { useProjectMenu } from "./useProjectMenu";

test("menu fits the viewport, skips disabled items and dismisses on outside click", async () => {
  const window = new Window({ width: 390, height: 844 });
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  try {
    const trigger = document.createElement("button");
    const panel = document.createElement("div");
    const disabled = document.createElement("button");
    disabled.setAttribute("role", "menuitem");
    disabled.disabled = true;
    const item = document.createElement("button");
    item.setAttribute("role", "menuitem");
    panel.append(disabled, item);
    document.body.append(trigger, panel);
    Object.defineProperty(panel, "offsetWidth", { value: 196 });
    Object.defineProperty(panel, "offsetHeight", { value: 100 });
    trigger.getBoundingClientRect = () => ({
      top: 800,
      bottom: 830,
      right: 388,
      left: 350,
      width: 38,
      height: 30,
      x: 350,
      y: 800,
      toJSON: () => ({}),
    });
    const { result } = renderHook(() => useProjectMenu());
    result.current.trigger.current = trigger;
    result.current.panel.current = panel;
    await act(async () => result.current.setOpen(true));
    expect(document.activeElement).toBe(item);
    expect(result.current.position).toEqual({ top: 736, left: 186 });
    await act(async () => result.current.close());
    expect(document.activeElement).toBe(trigger);
    await act(async () => result.current.setOpen(true));
    await act(async () =>
      document.body.dispatchEvent(
        new window.PointerEvent("pointerdown", { bubbles: true }) as unknown as Event,
      ),
    );
    expect(result.current.open).toBe(false);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("left-aligned project menus anchor to the trigger and preserve context-click positioning", async () => {
  const window = new Window({ width: 1000, height: 800 });
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  try {
    const trigger = document.createElement("button");
    const panel = document.createElement("div");
    document.body.append(trigger, panel);
    Object.defineProperty(panel, "offsetWidth", { value: 196 });
    Object.defineProperty(panel, "offsetHeight", { value: 100 });
    trigger.getBoundingClientRect = () => ({
      top: 100,
      bottom: 124,
      right: 224,
      left: 200,
      width: 24,
      height: 24,
      x: 200,
      y: 100,
      toJSON: () => ({}),
    });
    const { result, rerender } = renderHook(
      ({ point }: { point?: { x: number; y: number } }) => useProjectMenu(point, "left"),
      { initialProps: {} },
    );
    result.current.trigger.current = trigger;
    result.current.panel.current = panel;
    await act(async () => result.current.setOpen(true));
    expect(result.current.position).toEqual({ top: 130, left: 200 });
    rerender({ point: { x: 300, y: 400 } });
    expect(result.current.position).toEqual({ top: 400, left: 300 });
    rerender({ point: { x: 990, y: 790 } });
    expect(result.current.position).toEqual({ top: 692, left: 796 });
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
