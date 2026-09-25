import { expect, test } from "bun:test";
import { Window } from "happy-dom";

test("copy hook reports clipboard failure without throwing into the UI", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    navigator: globalThis.navigator,
  };

  Object.assign(globalThis, { window, document: window.document });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      clipboard: {
        writeText: async () => {
          throw new Error("Denied");
        },
      },
    },
  });

  try {
    const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
    const { useCopy } = await import("./useCopy");
    const { result } = renderHook(useCopy);

    await act(() => result.current.copy("hello"));
    expect(result.current.status).toBe("copyFailed");
    cleanup();
  } finally {
    Object.assign(globalThis, { window: previous.window, document: previous.document });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: previous.navigator,
    });
    await window.happyDOM.close();
  }
});
