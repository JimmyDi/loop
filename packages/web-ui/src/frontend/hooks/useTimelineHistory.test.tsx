import { Window } from "happy-dom";
import { expect, test } from "vitest";
import { useRef } from "react";

import { useTimelineHistory } from "./useTimelineHistory";
import type { TimelineTurn } from "../components/chat/timeline-turns";

const turns: TimelineTurn[] = Array.from({ length: 10 }, (_, index) => ({
  type: "user",
  index,
  message: { role: "user", content: `Request ${index}`, timestamp: index },
}));

test("history reveals three rounds at a time, preserves position and resets for another session", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup, fireEvent } = await import("@testing-library/react/pure");
  const View = ({ sessionId, items = turns }: { sessionId: string; items?: TimelineTurn[] }) => {
    const ref = useRef<HTMLDivElement>(null);
    const history = useTimelineHistory(sessionId, items, ref, () => {});
    return (
      <div
        ref={ref}
        onScroll={history.onScroll}
        onWheel={history.onWheel}
        onTouchStart={history.onTouchStart}
        onTouchMove={history.onTouchMove}
      >
        {items.slice(history.start).map((turn) => (
          <p key={turn.index}>{turn.index}</p>
        ))}
      </div>
    );
  };
  try {
    const ui = render(<View sessionId="first" />);
    const element = ui.container.firstElementChild as HTMLDivElement;
    Object.defineProperty(element, "scrollHeight", { get: () => element.children.length * 100 });
    expect(element.children).toHaveLength(3);
    expect(element.textContent).toBe("789");
    fireEvent.wheel(element, { deltaY: 100 });
    expect(element.children).toHaveLength(3);
    fireEvent.wheel(element, { deltaY: -100 });
    expect(element.children).toHaveLength(6);
    expect(element.scrollTop).toBe(300);
    element.scrollTop = 50;
    fireEvent.scroll(element);
    expect(element.children).toHaveLength(9);
    expect(element.scrollTop).toBe(350);
    element.scrollTop = 0;
    fireEvent.touchStart(element, { touches: [{ clientY: 50 }] });
    fireEvent.touchMove(element, { touches: [{ clientY: 100 }] });
    expect(element.children).toHaveLength(10);
    expect(element.scrollTop).toBe(100);
    element.scrollTop = 0;
    fireEvent.wheel(element, { deltaY: -100 });
    expect(element.children).toHaveLength(10);
    ui.rerender(<View sessionId="second" />);
    expect(element.children).toHaveLength(3);
    const next = { ...turns[0]!, index: 10 } as TimelineTurn;
    ui.rerender(<View sessionId="second" items={[...turns, next]} />);
    expect(element.children).toHaveLength(4);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("network history requests are deduplicated, retryable and preserve position after prepend", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup, fireEvent, act } = await import("@testing-library/react/pure");
  const { useSessions } = await import("../state/session-store");
  const { vi } = await import("vitest");
  const { pageSnapshot } = await import("../../shared/session-history");
  const full = {
    sessionId: "paged",
    streamId: "stream",
    workspaceId: "project",
    model: { id: "test", name: "Test", provider: "example" },
    operation: "idle" as const,
    tools: {},
    state: {
      messages: Array.from({ length: 10 }, (_, timestamp) => ({
        role: "user" as const,
        content: "Request " + timestamp,
        timestamp,
      })),
      isRunning: false,
      hasPendingSave: false,
      outcome: "idle" as const,
      listenerErrors: [],
    },
  };
  const latest = pageSnapshot(full);
  useSessions.setState({ views: { paged: { snapshot: latest, connected: true } } });
  let resolve: ((response: Response) => void) | undefined;
  const fetcher = vi.fn(
    (_url: string, _init?: RequestInit) =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  const View = () => {
    const snapshot = useSessions((state) => state.views.paged!.snapshot!);
    const ref = useRef<HTMLDivElement>(null);
    const history = useTimelineHistory("paged", turns, ref, () => {}, snapshot);
    return (
      <div ref={ref} onWheel={history.onWheel} onScroll={history.onScroll}>
        {history.loading && <span role="status">Loading more messages</span>}
        {history.error && (
          <button onClick={history.retry} type="button">
            Retry
          </button>
        )}
        {snapshot.state.messages.map((message) => (
          <p key={message.timestamp}>{message.timestamp}</p>
        ))}
      </div>
    );
  };
  try {
    const ui = render(<View />);
    const element = ui.container.firstElementChild as HTMLDivElement;
    Object.defineProperty(element, "scrollHeight", {
      get: () => element.querySelectorAll("p").length * 100,
    });
    fireEvent.wheel(element, { deltaY: -1 });
    fireEvent.wheel(element, { deltaY: -1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(element.style.overflowY).toBe("hidden");
    element.scrollTop = 70;
    fireEvent.scroll(element);
    expect(element.scrollTop).toBe(0);
    const wheel = new window.WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true });
    element.dispatchEvent(wheel as unknown as Event);
    expect(wheel.defaultPrevented).toBe(true);
    expect(ui.getByRole("status").textContent).toBe("Loading more messages");
    expect(fetcher.mock.calls[0]?.[0]).toContain("before=7&streamId=stream");
    await act(async () => {
      resolve!(new Response("{}", { status: 500 }));
    });
    expect(ui.queryByRole("status")).toBeNull();
    expect(ui.getByText("Retry")).toBeDefined();
    expect(element.style.overflowY).toBe("");
    fireEvent.click(ui.getByText("Retry"));
    expect(ui.getByRole("status")).toBeDefined();
    await act(async () => {
      resolve!(
        Response.json({
          streamId: "stream",
          start: 4,
          end: 7,
          total: 10,
          userStart: 4,
          messages: full.state.messages.slice(4, 7),
        }),
      );
    });
    expect(ui.queryByRole("status")).toBeNull();
    expect(element.style.overflowY).toBe("");
    expect(element.style.touchAction).toBe("");
    expect(element.querySelectorAll("p")).toHaveLength(6);
    expect(element.scrollTop).toBe(300);
    expect(useSessions.getState().views.paged!.snapshot!.history?.start).toBe(4);
  } finally {
    cleanup();
    vi.unstubAllGlobals();
    useSessions.setState({ views: {} });
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
