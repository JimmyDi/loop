import { expect, test } from "vitest";
import { Window } from "happy-dom";

test("composer respects IME composition and pastes plain text", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };

  Object.assign(globalThis, { window, document: window.document });

  try {
    const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
    const { useComposerInput } = await import("./useComposerInput");
    const element = window.document.createElement("div");
    let submitted = 0;
    let changed = "";
    const { result } = renderHook(() =>
      useComposerInput(
        "",
        (text) => {
          changed = text;
        },
        () => {
          submitted++;
        },
      ),
    );

    result.current.ref.current = element as unknown as HTMLDivElement;
    const event = {
      key: "Enter",
      shiftKey: false,
      nativeEvent: { isComposing: false },
      keyCode: 13,
      preventDefault() {},
    };

    act(() => {
      result.current.onCompositionStart();
      result.current.onKeyDown(event as unknown as Parameters<typeof result.current.onKeyDown>[0]);
    });
    expect(submitted).toBe(0);
    act(() => {
      result.current.onCompositionEnd();
      result.current.onKeyDown(event as unknown as Parameters<typeof result.current.onKeyDown>[0]);
    });
    expect(submitted).toBe(1);
    element.innerText = "plain";
    act(() => result.current.onInput());
    expect(changed).toBe("plain");
    cleanup();
  } finally {
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("touch keyboard Enter inserts a line; Ctrl Enter still submits", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  window.matchMedia = () => ({ matches: true }) as ReturnType<typeof window.matchMedia>;
  const { renderHook, cleanup } = await import("@testing-library/react/pure");
  try {
    const { useComposerInput } = await import("./useComposerInput");
    let submitted = 0;
    let prevented = 0;
    const { result } = renderHook(() =>
      useComposerInput(
        "",
        () => {},
        () => submitted++,
      ),
    );
    const event = {
      key: "Enter",
      shiftKey: false,
      ctrlKey: false,
      nativeEvent: { isComposing: false },
      preventDefault: () => prevented++,
    };
    result.current.onKeyDown(event as unknown as Parameters<typeof result.current.onKeyDown>[0]);
    expect(submitted).toBe(0);
    expect(prevented).toBe(0);
    result.current.onKeyDown({ ...event, ctrlKey: true } as unknown as Parameters<
      typeof result.current.onKeyDown
    >[0]);
    expect(submitted).toBe(1);
    expect(prevented).toBe(1);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
