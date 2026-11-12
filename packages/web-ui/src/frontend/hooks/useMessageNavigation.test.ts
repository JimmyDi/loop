import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import type { SessionSnapshot } from "../../shared/protocol";
import { useMessageNavigation } from "./useMessageNavigation";

test("partial history page boundaries preserve the visible turn until the live tail is reached", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const previews = Array.from({ length: 100 }, (_, index) => ({
    index,
    user: "Request " + index,
    reply: "",
  }));
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => Response.json({ previews, bookmarks: [] }));
  const element = window.document.createElement("div");
  element.innerHTML =
    '<div class="timeline-content"><div class="virtual-list"><div class="virtual-row" data-row-key="test:40"></div></div></div>';
  const row = element.querySelector(".virtual-row")! as unknown as HTMLElement;
  row.getBoundingClientRect = () => new window.DOMRect(0, -20, 100, 100);
  let height = 600;
  Object.defineProperties(element, {
    scrollHeight: { get: () => height },
    clientHeight: { get: () => 200 },
  });
  element.scrollTop = 400;
  const viewport = { current: element as unknown as HTMLDivElement };
  const snapshot = {
    sessionId: "test",
    streamId: "stream",
    operation: "idle",
    state: { messages: [] },
    tools: {},
    history: { start: 97, total: 100, userStart: 97 },
  } as unknown as SessionSnapshot;
  try {
    const ui = renderHook(({ later }) => useMessageNavigation(snapshot, viewport, later), {
      initialProps: { later: true },
    });
    await act(async () => {});
    act(() => fireEvent.scroll(element as unknown as HTMLDivElement));
    expect(ui.result.current.active).toBe(40);
    await act(async () => {
      height = 900;
      row.parentElement!.insertAdjacentHTML("beforeend", "<div></div>");
    });
    expect(ui.result.current.active).toBe(40);
    element.scrollTop = 700;
    act(() => fireEvent.scroll(element as unknown as HTMLDivElement));
    expect(ui.result.current.active).toBe(40);
    row.dataset.rowKey = "test:41";
    act(() => fireEvent.scroll(element as unknown as HTMLDivElement));
    expect(ui.result.current.active).toBe(41);
    ui.rerender({ later: false });
    expect(ui.result.current.active).toBe(99);
  } finally {
    cleanup();
    fetcher.mockRestore();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
