import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";

const createDeferred = () => {
  let resolve!: () => void;
  let reject!: (reason?: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const setupCopyHook = async (writeText: (text: string) => Promise<void>) => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    navigator: globalThis.navigator,
  };
  Object.assign(globalThis, { window, document: window.document });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { userAgent: window.navigator.userAgent, clipboard: { writeText } },
  });

  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  const { useCopy } = await import("./useCopy");
  const { result, unmount } = renderHook(useCopy);

  return {
    result,
    act,
    unmount,
    cleanup,
    restore: async () => {
      Object.assign(globalThis, { window: previous.window, document: previous.document });
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: previous.navigator,
      });
      await window.happyDOM.close();
    },
  };
};

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

test("latest copy result wins when clipboard promises settle out of order", async () => {
  const first = createDeferred();
  const second = createDeferred();
  const hook = await setupCopyHook((text) => (text === "first" ? first.promise : second.promise));
  vi.useFakeTimers();
  try {
    const firstCopy = hook.result.current.copy("first");
    const secondCopy = hook.result.current.copy("second");

    await hook.act(async () => {
      second.resolve();
      await secondCopy;
    });
    expect(hook.result.current.status).toBe("copied");
    expect(vi.getTimerCount()).toBe(1);

    await hook.act(async () => {
      first.reject(new Error("stale failure"));
      await firstCopy;
    });
    expect(hook.result.current.status).toBe("copied");
    expect(vi.getTimerCount()).toBe(1);
  } finally {
    hook.cleanup();
    vi.useRealTimers();
    await hook.restore();
  }
});

test("stale success does not replace the latest copy failure", async () => {
  const first = createDeferred();
  const second = createDeferred();
  const hook = await setupCopyHook((text) => (text === "first" ? first.promise : second.promise));
  vi.useFakeTimers();
  try {
    const firstCopy = hook.result.current.copy("first");
    const secondCopy = hook.result.current.copy("second");

    await hook.act(async () => {
      second.reject(new Error("latest failure"));
      await secondCopy;
    });
    expect(hook.result.current.status).toBe("copyFailed");
    expect(vi.getTimerCount()).toBe(1);

    await hook.act(async () => {
      first.resolve();
      await firstCopy;
    });
    expect(hook.result.current.status).toBe("copyFailed");
    expect(vi.getTimerCount()).toBe(1);
  } finally {
    hook.cleanup();
    vi.useRealTimers();
    await hook.restore();
  }
});

test("a pending copy after unmount does not schedule a reset timer", async () => {
  const pending = createDeferred();
  const hook = await setupCopyHook(() => pending.promise);
  vi.useFakeTimers();
  try {
    const copy = hook.result.current.copy("pending");
    hook.unmount();

    await hook.act(async () => {
      pending.resolve();
      await copy;
    });
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    hook.cleanup();
    vi.useRealTimers();
    await hook.restore();
  }
});
