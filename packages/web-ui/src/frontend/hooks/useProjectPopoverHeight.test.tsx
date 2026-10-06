import { useRef } from "react";
import { expect, test } from "vitest";
import { Window } from "happy-dom";

import { useProjectPopoverHeight } from "./useProjectPopoverHeight";

test("project popover fits above the composer below the header and updates on resize", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, act, cleanup } = await import("@testing-library/react/pure");
  const original = window.HTMLElement.prototype.getBoundingClientRect;
  let anchorTop = 310;
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    return new window.DOMRect(
      0,
      this.className === "chat-workspace-body" ? 64 : anchorTop,
      280,
      40,
    );
  };
  const View = () => {
    const root = useRef<HTMLDivElement>(null);
    const height = useProjectPopoverHeight(true, root);
    return (
      <div className="chat-workspace-body">
        <div ref={root} data-testid="height">
          {height}
        </div>
      </div>
    );
  };
  try {
    const ui = render(<View />);
    expect(ui.getByTestId("height").textContent).toBe("min(320px, 232px)");
    anchorTop = 256;
    act(() => {
      window.dispatchEvent(new window.Event("resize"));
    });
    expect(ui.getByTestId("height").textContent).toBe("min(320px, 178px)");
  } finally {
    cleanup();
    window.HTMLElement.prototype.getBoundingClientRect = original;
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
