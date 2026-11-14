import { expect, test } from "vitest";
import { Window } from "happy-dom";

import { PanelResizer } from "./PanelResizer";
import "../../i18n/setup";

test("drag and keyboard resize from the left edge within usable bounds", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  try {
    let ratio = 0.5;
    const dragging: boolean[] = [];
    const view = render(
      <div className="chat-plan-layout">
        <PanelResizer
          ratio={ratio}
          change={(value) => {
            ratio = value;
          }}
          dragging={(value) => dragging.push(value)}
        />
      </div>,
    );
    const root = view.container.firstElementChild as HTMLElement;
    root.getBoundingClientRect = () => ({ left: 100, right: 1100, width: 1000 }) as DOMRect;
    const handle = view.getByRole("separator");
    Object.assign(handle, { setPointerCapture: () => {}, releasePointerCapture: () => {} });
    const pointer = (type: string, clientX: number) =>
      fireEvent(
        handle,
        new window.PointerEvent(type, {
          bubbles: true,
          pointerId: 1,
          button: 0,
          clientX,
        }) as unknown as Event,
      );
    pointer("pointerdown", 600);
    pointer("pointermove", 400);
    expect(ratio).toBe(0.68);
    pointer("pointermove", 1090);
    expect(ratio).toBe(0.28);
    pointer("pointerup", 1090);
    expect(dragging).toEqual([true, false]);
    pointer("pointermove", 600);
    expect(ratio).toBe(0.28);
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(ratio).toBe(0.516);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
