import { useRef } from "react";
import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import type { SessionSnapshot } from "../../shared/protocol";
import { useTimelineWindow } from "./useTimelineWindow";

test("unloaded targets use one bounded request, page both ways, and preserve the live snapshot", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup, fireEvent, act } = await import("@testing-library/react/pure");
  const messages = Array.from({ length: 100 }, (_, timestamp) => ({
    role: "user" as const,
    content: "Request " + timestamp,
    timestamp,
  }));
  const live = {
    sessionId: "test",
    streamId: "stream",
    history: { start: 97, total: 100, userStart: 97 },
    state: { messages: messages.slice(97) },
    tools: {},
  } as SessionSnapshot;
  const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    const params = new URL(String(url), "http://localhost").searchParams;
    const index = Number(params.get("target") ?? params.get("after"));
    const start = params.has("target") ? Math.max(0, index - 1) : index;
    return Response.json({
      streamId: "stream",
      start,
      end: start + 3,
      total: 100,
      userStart: start,
      messages: messages.slice(start, start + 3),
    });
  });
  let state: ReturnType<typeof useTimelineWindow>;
  const View = ({ snapshot = live }: { snapshot?: SessionSnapshot }) => {
    const ref = useRef<HTMLDivElement>(null);
    state = useTimelineWindow(snapshot, ref);
    return (
      <div ref={ref}>
        <button type="button" onClick={() => state.select(4)}>
          Jump
        </button>
        {state.snapshot.state.messages.map((message) => (
          <p key={message.timestamp}>{message.timestamp}</p>
        ))}
      </div>
    );
  };
  try {
    const ui = render(<View />);
    await act(async () => fireEvent.click(ui.getByText("Jump")));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0]![0])).toContain("target=4");
    expect(state!.snapshot.state.messages).toHaveLength(3);
    expect(state!.target?.key).toBe("test:4");
    expect(state!.detached).toBe(true);
    expect(live.state.messages).toHaveLength(3);
    act(() => state!.complete());
    expect(state!.target).toBeUndefined();
    await act(async () => state!.forward());
    expect(String(fetcher.mock.calls[1]![0])).toContain("after=6");
    expect(state!.snapshot.state.messages).toHaveLength(6);
    act(() => {
      expect(
        state!.prepend!({
          streamId: "stream",
          start: 1,
          end: 3,
          total: 100,
          userStart: 1,
          messages: messages.slice(1, 3),
        }),
      ).toBe(true);
    });
    expect(state!.snapshot.history?.start).toBe(1);
    act(() => state!.select(98));
    expect(state!.snapshot).toBe(live);
    expect(state!.target?.key).toBe("test:98");
    fetcher.mockRejectedValueOnce(new Error("unavailable"));
    await act(async () => state!.select(20));
    expect(state!.error).toBe(true);
    await act(async () => state!.retry());
    expect(state!.snapshot.history?.start).toBe(19);
    let resolveOld: ((response: Response) => void) | undefined;
    fetcher.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveOld = resolve;
        }),
    );
    act(() => state!.select(30));
    await act(async () => state!.select(40));
    await act(async () =>
      resolveOld!(
        Response.json({
          streamId: "stream",
          start: 30,
          end: 33,
          total: 100,
          userStart: 30,
          messages: messages.slice(30, 33),
        }),
      ),
    );
    expect(state!.snapshot.history?.start).toBe(39);
    expect(state!.target?.key).toBe("test:40");
    ui.rerender(<View snapshot={{ ...live, streamId: "new" }} />);
    expect(state!.detached).toBe(false);
    expect(state!.target).toBeUndefined();
  } finally {
    cleanup();
    fetcher.mockRestore();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
