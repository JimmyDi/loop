import { Window } from "happy-dom";
import { expect, test } from "vitest";

import { useOnlineStatus } from "./useOnlineStatus";

test("online state follows network events", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  try {
    const { result } = renderHook(useOnlineStatus);
    expect(result.current).toBe(true);
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
    act(() => window.dispatchEvent(new window.Event("offline")));
    expect(result.current).toBe(false);
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
    act(() => window.dispatchEvent(new window.Event("online")));
    expect(result.current).toBe(true);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
