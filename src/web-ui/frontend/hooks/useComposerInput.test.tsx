import { expect, test } from "bun:test";
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
      result.current.onKeyDown(event as Parameters<typeof result.current.onKeyDown>[0]);
    });
    expect(submitted).toBe(0);
    act(() => {
      result.current.onCompositionEnd();
      result.current.onKeyDown(event as Parameters<typeof result.current.onKeyDown>[0]);
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
