import { expect, test } from "vitest";
import { Window } from "happy-dom";

import { useSkillScopeLayout } from "./useSkillScopeLayout";

test("layout observes width changes and releases observers on unmount", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    ResizeObserver: globalThis.ResizeObserver,
  };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup, act } = await import("@testing-library/react/pure");
  const callbacks = new Set<() => void>();
  class Observer {
    constructor(private callback: () => void) {
      callbacks.add(callback);
    }
    observe() {}
    disconnect() {
      callbacks.delete(this.callback);
    }
  }
  globalThis.ResizeObserver = Observer as unknown as typeof ResizeObserver;
  const bounds = window.HTMLElement.prototype.getBoundingClientRect;
  let available = 300;
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    return new window.DOMRect(0, 0, this.getAttribute("data-root") ? available : 60, 36);
  };
  const Layout = ({ selected }: { selected: number }) => {
    const { root, measurements, visible } = useSkillScopeLayout(
      ["Personal", "Example", "Other"],
      selected,
    );
    return (
      <div data-root="true" ref={root}>
        <div ref={measurements}>
          <span>Personal</span>
          <span>Example</span>
          <span>Other</span>
          <span>…</span>
        </div>
        <output>{visible.join(",")}</output>
      </div>
    );
  };
  try {
    const view = render(<Layout selected={0} />);
    expect(view.getByRole("status").textContent).toBe("0,1,2");
    await act(async () => {
      available = 150;
      for (const callback of callbacks) callback();
    });
    expect(view.getByRole("status").textContent).toBe("0");
    await act(async () => {
      available = 180;
      window.dispatchEvent(new window.Event("resize"));
    });
    expect(view.getByRole("status").textContent).toBe("0,1,2");
    await act(async () => {
      available = 179;
      for (const callback of callbacks) callback();
    });
    view.rerender(<Layout selected={2} />);
    expect(view.getByRole("status").textContent).toBe("0");
    view.unmount();
    expect(callbacks.size).toBe(0);
  } finally {
    cleanup();
    window.HTMLElement.prototype.getBoundingClientRect = bounds;
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
