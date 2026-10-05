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
