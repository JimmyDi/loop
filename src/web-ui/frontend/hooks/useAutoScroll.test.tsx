import { expect, test } from "bun:test";
import { Window } from "happy-dom";

import { useAutoScroll } from "./useAutoScroll";

test("new user turns align at the top without following response growth or manual scrolling", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    ResizeObserver: globalThis.ResizeObserver,
  };
  const resizeCallbacks = new Set<() => void>();
  class ResizeObserver {
    constructor(private callback: () => void) {
      resizeCallbacks.add(callback);
    }
    observe() {}
    disconnect() {
      resizeCallbacks.delete(this.callback);
    }
  }
  Object.assign(globalThis, { window, document: window.document, ResizeObserver });
  const { render, cleanup, act } = await import("@testing-library/react/pure");
  let scroll: ReturnType<typeof useAutoScroll>;
  let viewportHeight = 500;
  let userTop = 800;
  let contentHeight = 1800;
  let scrollTop = 0;
  const rect = (top: number, height: number) => ({
    top,
    bottom: top + height,
    height,
    left: 0,
    right: 100,
    width: 100,
    x: 0,
    y: top,
    toJSON: () => ({}),
  });
  const Harness = (props: Parameters<typeof useAutoScroll>[0]) => {
    scroll = useAutoScroll(props);
    return (
      <div
        ref={(element) => {
          scroll.ref.current = element;
          if (!element) return;
          const layoutHeight = () =>
            Math.max(
              contentHeight,
              Number.parseFloat(scroll.contentRef.current?.style.minHeight ?? "0") || 0,
            );
          Object.defineProperties(element, {
            clientHeight: { configurable: true, get: () => viewportHeight },
            scrollHeight: { configurable: true, get: () => layoutHeight() + 50 },
            scrollTop: {
              configurable: true,
              get: () => scrollTop,
              set: (value: number) => {
                scrollTop = Math.max(0, Math.min(value, element.scrollHeight - viewportHeight));
              },
            },
          });
          element.getBoundingClientRect = () => rect(0, viewportHeight);
        }}
        style={{ paddingTop: 20, paddingBottom: 30 }}
      >
        <div
          ref={(element) => {
            scroll.contentRef.current = element;
            if (element)
              element.getBoundingClientRect = () =>
                rect(
                  20 - scrollTop,
                  Math.max(contentHeight, Number.parseFloat(element.style.minHeight) || 0),
                );
          }}
        >
          <article
            ref={(element) => {
              scroll.userMessageRef.current = element;
              if (element)
                element.getBoundingClientRect = () => rect(20 + userTop - scrollTop, 100);
            }}
          />
          <div
            ref={(element) => {
              scroll.endRef.current = element;
              if (element)
                element.getBoundingClientRect = () => rect(20 + contentHeight - scrollTop, 0);
            }}
          />
        </div>
      </div>
    );
  };
  let props = { sessionId: "session", userMessageIndex: 0, running: false, revision: 0 };

  try {
    const ui = render(<Harness {...props} />);
    expect(scrollTop).toBe(1350);
    expect(scroll!.contentRef.current?.style.minHeight).toBe("0px");

    // A short new turn needs enough space below it to actually reach the top.
    userTop = 1800;
    contentHeight = 1950;
    props = { ...props, userMessageIndex: 2, running: true, revision: 1 };
    ui.rerender(<Harness {...props} />);
    expect(scrollTop).toBe(1800);
    expect(scroll!.userMessageRef.current?.getBoundingClientRect().top).toBe(20);
    expect(scroll!.contentRef.current?.style.minHeight).toBe("2250px");
    expect(scroll!.atBottom).toBe(true);

    // Programmatic alignment also emits a scroll event. It must not enable following.
    act(() => scroll!.onScroll());
    contentHeight = 2100;
    ui.rerender(<Harness {...props} revision={2} />);
    expect(scrollTop).toBe(1800);
    expect(scroll!.contentRef.current?.style.minHeight).toBe("2250px");
    contentHeight = 2600;
    ui.rerender(<Harness {...props} revision={3} />);
    expect(scrollTop).toBe(1800);
    expect(scroll!.contentRef.current?.style.minHeight).toBe("2250px");
    expect(scroll!.atBottom).toBe(false);

    // Jumping to the response is a one-time navigation action.
    act(() => scroll!.jump());
    expect(scrollTop).toBe(2150);
    contentHeight = 2900;
    act(() => {
      for (const callback of resizeCallbacks) callback();
    });
    expect(scrollTop).toBe(2150);
    expect(scroll!.atBottom).toBe(false);
    scrollTop = 1000;
    act(() => scroll!.onScroll());
    ui.rerender(<Harness {...props} running={false} revision={4} />);
    expect(scrollTop).toBe(1000);
    ui.rerender(<Harness {...props} running={false} revision={5} />);
    expect(scrollTop).toBe(1000);

    // A subsequent send overrides the old reading position, including after a resize.
    userTop = 2900;
    contentHeight = 3000;
    props = { ...props, userMessageIndex: 4, revision: 6 };
    ui.rerender(<Harness {...props} />);
    expect(scrollTop).toBe(2900);
    expect(scroll!.contentRef.current?.style.minHeight).toBe("3350px");
    viewportHeight = 600;
    act(() => {
      for (const callback of resizeCallbacks) callback();
    });
    expect(scrollTop).toBe(2900);
    expect(scroll!.contentRef.current?.style.minHeight).toBe("3450px");
    contentHeight = 3050;
    act(() => {
      for (const callback of resizeCallbacks) callback();
    });
    expect(scrollTop).toBe(2900);
    expect(scroll!.contentRef.current?.style.minHeight).toBe("3450px");
    ui.rerender(<Harness {...props} running={false} revision={7} />);
    expect(scrollTop).toBe(2900);
    expect(scroll!.contentRef.current?.style.minHeight).toBe("3450px");

    // Completed history clears reserved space; active history opens at its user turn.
    ui.rerender(<Harness {...props} sessionId="history" running={false} />);
    expect(scroll!.contentRef.current?.style.minHeight).toBe("0px");
    expect(scrollTop).toBe(2500);
    ui.rerender(<Harness {...props} sessionId="active" />);
    expect(scrollTop).toBe(2900);
    expect(scroll!.contentRef.current?.style.minHeight).toBe("3450px");
    expect(resizeCallbacks.size).toBe(1);
    ui.unmount();
    expect(resizeCallbacks.size).toBe(0);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
