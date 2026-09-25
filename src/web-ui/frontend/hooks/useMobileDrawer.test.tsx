import { expect, test } from "bun:test";
import { Window } from "happy-dom";

test("closed mobile drawer is inert to keyboard navigation", async () => {
  const window = new Window({ width: 390 });
  const previous = { window: globalThis.window, document: globalThis.document };

  Object.assign(globalThis, { window, document: window.document });

  try {
    const { renderHook, cleanup } = await import("@testing-library/react/pure");
    const { useMobileDrawer } = await import("./useMobileDrawer");
    const element = window.document.createElement("div");
    const ref = { current: element as unknown as HTMLElement };

    renderHook(() => useMobileDrawer(ref, false, () => {}));
    expect(element.inert).toBe(true);
    cleanup();
  } finally {
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
