import { Window } from "happy-dom";
import { expect, test } from "vitest";

import { useVisualViewport } from "./useVisualViewport";

test("keyboard resize and pan update visible bounds without overriding pinch zoom", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  const viewport = new window.EventTarget();
  const bounds = { height: 800, offsetTop: 0, scale: 1 };
  for (const key of ["height", "offsetTop", "scale"] as const) {
    Object.defineProperty(viewport, key, { get: () => bounds[key] });
  }
  Object.defineProperty(window, "visualViewport", { value: viewport });
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup, act } = await import("@testing-library/react/pure");
  const Harness = () => <div ref={useVisualViewport()} />;
  try {
    const view = render(<Harness />);
    const element = view.container.firstElementChild as HTMLDivElement;
    expect(element.style.getPropertyValue("--app-viewport-height")).toBe("800px");
    act(() => {
      bounds.height = 420;
      viewport.dispatchEvent(new window.Event("resize"));
      bounds.offsetTop = 40;
      viewport.dispatchEvent(new window.Event("scroll"));
    });
    expect(element.style.getPropertyValue("--app-viewport-height")).toBe("420px");
    expect(element.style.getPropertyValue("--app-viewport-top")).toBe("40px");
    act(() => {
      bounds.scale = 2;
      bounds.height = 200;
      viewport.dispatchEvent(new window.Event("resize"));
    });
    expect(element.style.getPropertyValue("--app-viewport-height")).toBe("420px");
    act(() => {
      Object.assign(bounds, { height: 800, offsetTop: 0, scale: 1 });
      viewport.dispatchEvent(new window.Event("resize"));
    });
    expect(element.style.getPropertyValue("--app-viewport-height")).toBe("800px");
    expect(element.style.getPropertyValue("--app-viewport-top")).toBe("0px");
    view.unmount();
    bounds.height = 100;
    viewport.dispatchEvent(new window.Event("resize"));
    expect(element.style.getPropertyValue("--app-viewport-height")).toBe("");
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
