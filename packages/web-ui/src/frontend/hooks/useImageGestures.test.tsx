import { Window } from "happy-dom";
import { expect, test } from "vitest";

import { useImageGestures } from "./useImageGestures";

test("pinch zoom stays within the image, pans, suppresses taps and resets for another image", async () => {
  const window = new Window({
    url: "https://example.test",
    settings: { handleDisabledFileLoadingAsSuccess: true },
  });
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, act, cleanup } = await import("@testing-library/react/pure");
  const Viewer = ({ source }: { source: string }) => {
    const gesture = useImageGestures(source);
    return (
      <div ref={gesture.ref} data-testid="viewer">
        <button type="button" onClick={gesture.toggle} aria-pressed={gesture.zoomed}>
          <img src={source} alt="Example" />
        </button>
      </div>
    );
  };
  try {
    const view = render(<Viewer source="/first.png" />);
    const viewer = view.getByTestId("viewer");
    const image = view.getByRole("img");
    for (const element of [viewer, image]) {
      Object.defineProperty(element, "clientWidth", { configurable: true, value: 200 });
      Object.defineProperty(element, "clientHeight", { configurable: true, value: 200 });
    }
    viewer.getBoundingClientRect = () =>
      ({ left: 30, top: 50, width: 200, height: 200 }) as DOMRect;
    fireEvent.click(view.getByRole("button"), { clientX: 80, clientY: 110, detail: 1 });
    expect(image.style.transform).toBe("translate(50px, 40px) scale(2)");
    fireEvent.click(view.getByRole("button"), { clientX: 80, clientY: 110, detail: 1 });
    expect(image.style.transform).toBe("translate(0px, 0px) scale(1)");
    // Keyboard activation has no pointer coordinates and remains centered.
    fireEvent.click(view.getByRole("button"), { detail: 0 });
    expect(image.style.transform).toBe("translate(0px, 0px) scale(2)");
    fireEvent.click(view.getByRole("button"), { detail: 0 });
    viewer.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 }) as DOMRect;
    const touch = (type: string, points: number[][]) => {
      const event = new window.Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, "touches", {
        value: points.map(([clientX, clientY]) => ({ clientX, clientY })),
      });
      act(() => viewer.dispatchEvent(event as unknown as Event));
      return event;
    };
    expect(
      touch("touchstart", [
        [50, 100],
        [150, 100],
      ]).defaultPrevented,
    ).toBe(true);
    expect(
      touch("touchmove", [
        [0, 100],
        [200, 100],
      ]).defaultPrevented,
    ).toBe(true);
    expect(image.style.transform).toBe("translate(0px, 0px) scale(2)");
    touch("touchend", [[200, 100]]);
    touch("touchmove", [[240, 130]]);
    expect(image.style.transform).toBe("translate(40px, 30px) scale(2)");
    touch("touchmove", [[900, 900]]);
    expect(image.style.transform).toBe("translate(100px, 100px) scale(2)");
    touch("touchend", []);
    fireEvent.click(view.getByRole("button"));
    expect(view.getByRole("button").getAttribute("aria-pressed")).toBe("true");
    touch("touchstart", [
      [0, 100],
      [200, 100],
    ]);
    touch("touchmove", [
      [99, 100],
      [101, 100],
    ]);
    expect(image.style.transform).toBe("translate(0px, 0px) scale(1)");
    touch("touchend", []);
    touch("touchstart", [
      [90, 100],
      [110, 100],
    ]);
    touch("touchmove", [
      [-900, 100],
      [1100, 100],
    ]);
    expect(image.style.transform).toBe("translate(0px, 0px) scale(8)");
    touch("touchcancel", []);
    view.rerender(<Viewer source="/second.png" />);
    expect(view.getByRole("button").getAttribute("aria-pressed")).toBe("false");
    expect(view.getByRole("img").style.transform).toBe("");
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
