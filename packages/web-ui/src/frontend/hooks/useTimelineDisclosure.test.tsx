import { expect, test } from "vitest";
import { Window } from "happy-dom";
import type { ReactNode } from "react";

import { TimelineDisclosures } from "../lib/timeline-disclosures";
import { useTimelineDisclosure } from "./useTimelineDisclosure";

test("disclosure choices survive remount but reset with a new session context", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, cleanup, act } = await import("@testing-library/react/pure");
  let saved = new Map<string, boolean>();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TimelineDisclosures value={saved}>{children}</TimelineDisclosures>
  );
  try {
    const hook = renderHook(() => useTimelineDisclosure("tool:example"), { wrapper });
    act(() => hook.result.current[1](true));
    expect(saved.get("tool:example")).toBe(true);
    hook.unmount();
    const remount = renderHook(() => useTimelineDisclosure("tool:example"), { wrapper });
    expect(remount.result.current[0]).toBe(true);
    saved = new Map();
    remount.rerender();
    expect(remount.result.current[0]).toBe(false);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
