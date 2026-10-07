import { expect, test } from "vitest";
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
      userAgent: window.navigator.userAgent,
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

test("rich clipboard failure falls back to readable plain text", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    navigator: globalThis.navigator,
    ClipboardItem: globalThis.ClipboardItem,
  };
  let plain = "";
  Object.assign(globalThis, { window, document: window.document, ClipboardItem: class {} });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      userAgent: window.navigator.userAgent,
      clipboard: {
        write: async () => {
          throw new Error("Unsupported rich clipboard");
        },
        writeText: async (text: string) => {
          plain = text;
        },
      },
    },
  });
  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  const { useCopy } = await import("./useCopy");
  try {
    const { result } = renderHook(useCopy);
    await act(() => result.current.copy("Review Task", "<div>Review Task</div>"));
    expect(plain).toBe("Review Task");
    expect(result.current.status).toBe("copied");
  } finally {
    cleanup();
    Object.assign(globalThis, {
      window: previous.window,
      document: previous.document,
      ClipboardItem: previous.ClipboardItem,
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: previous.navigator,
    });
    await window.happyDOM.close();
  }
});
