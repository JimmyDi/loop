import { expect, test } from "vitest";
import { Window } from "happy-dom";
import { useRef } from "react";

import { VirtualList } from "../components/chat/VirtualList";

test("scrolling updates the window when the viewport ref belongs to the parent", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup, act } = await import("@testing-library/react/pure");
  const original = window.HTMLElement.prototype.getBoundingClientRect;
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    const rect = original.call(this);
    if (this.classList.contains("virtual-list")) rect.y = -this.parentElement!.scrollTop;
    return rect;
  };
  const rows = Array.from({ length: 10000 }, (_, index) => ({
    key: String(index),
    render: () => <p>Row {index}</p>,
  }));
  const Timeline = () => {
    const viewport = useRef<HTMLDivElement>(null);
    return (
      <div ref={viewport}>
        <VirtualList rows={rows} viewport={viewport} pinned={[9998]} />
      </div>
    );
  };
  try {
    const ui = render(<Timeline />);
    const viewport = ui.container.firstElementChild! as HTMLElement;
    Object.defineProperty(viewport, "clientHeight", { value: 600 });
    act(() => {
      viewport.scrollTop = 800000;
      viewport.dispatchEvent(new window.Event("scroll") as unknown as Event);
    });
    expect(ui.container.querySelector('[data-row-key="5000"]')).not.toBeNull();
    expect(ui.container.querySelector('[data-row-key="0"]')).toBeNull();
    expect(ui.container.querySelector('[data-row-key="9998"]')).not.toBeNull();
    expect(ui.container.querySelectorAll(".virtual-row").length).toBeLessThan(20);
    act(() => {
      viewport.scrollTop = 0;
      viewport.dispatchEvent(new window.Event("scroll") as unknown as Event);
    });
    expect(ui.container.querySelector('[data-row-key="0"]')).not.toBeNull();
    expect(ui.container.querySelector('[data-row-key="5000"]')).toBeNull();
  } finally {
    cleanup();
    window.HTMLElement.prototype.getBoundingClientRect = original;
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("variable height changes above the viewport compensate scroll and observers cover only mounted rows", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const callbacks: ((entries: { target: Element }[]) => void)[] = [];
  const observed: Element[][] = [];
  let disposed = 0;
  Object.assign(window, {
    ResizeObserver: class {
      private nodes: Element[];
      constructor(callback: (entries: { target: Element }[]) => void) {
        callbacks.push(callback);
        this.nodes = [];
        observed.push(this.nodes);
      }
      observe(node: Element) {
        this.nodes.push(node);
      }
      disconnect() {
        disposed++;
      }
    },
  });
  const { render, cleanup, act } = await import("@testing-library/react/pure");
  const element = window.document.createElement("div");
  Object.defineProperty(element, "clientHeight", { value: 600 });
  let top = 1600;
  Object.defineProperty(element, "scrollTop", {
    get: () => top,
    set: (value) => {
      top = value;
    },
  });
  const rect = window.HTMLElement.prototype.getBoundingClientRect;
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    const bounds = rect.call(this);
    if (this.classList.contains("virtual-list")) bounds.y = -top;
    return bounds;
  };
  try {
    const rows = Array.from({ length: 10000 }, (_, index) => ({
      key: String(index),
      render: () => <p>Row {index}</p>,
    }));
    const ui = render(
      <VirtualList rows={rows} viewport={{ current: element as unknown as HTMLDivElement }} />,
    );
    const nodes = ui.container.querySelectorAll<HTMLElement>(".virtual-row");
    expect(nodes.length).toBeLessThan(20);
    const above = nodes[0]!;
    above.getBoundingClientRect = () => ({ height: 300, bottom: -20 }) as DOMRect;
    const index = observed.findLastIndex((nodes) => nodes.includes(above));
    expect(observed[index]!.length).toBeLessThan(20);
    act(() => callbacks[index]!([{ target: above as unknown as Element }]));
    expect(top).toBe(1740);
    expect(ui.container.querySelectorAll(".virtual-row").length).toBeLessThan(20);
    ui.unmount();
    expect(disposed).toBe(callbacks.length);
  } finally {
    cleanup();
    window.HTMLElement.prototype.getBoundingClientRect = rect;
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
