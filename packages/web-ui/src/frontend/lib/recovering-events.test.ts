import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import { recoveringEvents } from "./recovering-events";

test("streams recover on foreground, network return, stale heartbeats and ignore closed callbacks", () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    EventSource: globalThis.EventSource,
  };
  const sources: Source[] = [];
  class Source {
    onmessage?: (event: MessageEvent) => void;
    onerror?: () => void;
    heartbeat?: () => void;
    closed = false;
    constructor(readonly url: string) {
      sources.push(this);
    }
    addEventListener(_name: string, callback: () => void) {
      this.heartbeat = callback;
    }
    close() {
      this.closed = true;
    }
  }
  Object.assign(globalThis, { window, document: window.document, EventSource: Source });
  vi.useFakeTimers();
  let cursor = 0;
  const message = vi.fn(() => cursor++);
  const disconnected = vi.fn();
  const stream = recoveringEvents({ url: () => "/events?cursor=" + cursor, message, disconnected });
  try {
    sources[0]!.onmessage?.({} as MessageEvent);
    Object.defineProperty(window.document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    window.document.dispatchEvent(new window.Event("visibilitychange"));
    Object.defineProperty(window.document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    window.document.dispatchEvent(new window.Event("visibilitychange"));
    expect(sources[0]!.closed).toBe(true);
    expect(sources[1]!.url).toBe("/events?cursor=1");
    sources[0]!.onmessage?.({} as MessageEvent);
    sources[0]!.onerror?.();
    expect(message).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new window.Event("offline"));
    expect(sources[1]!.closed).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(sources).toHaveLength(2);
    window.dispatchEvent(new window.Event("online"));
    expect(sources).toHaveLength(3);
    vi.advanceTimersByTime(30_000);
    sources[2]!.heartbeat?.();
    vi.advanceTimersByTime(30_000);
    expect(sources).toHaveLength(3);
    vi.advanceTimersByTime(30_000);
    expect(sources[2]!.closed).toBe(true);
    expect(sources).toHaveLength(4);
    sources[3]!.onerror?.();
    vi.advanceTimersByTime(1499);
    expect(sources).toHaveLength(4);
    vi.advanceTimersByTime(1);
    expect(sources).toHaveLength(5);
    sources[4]!.onerror?.();
    vi.advanceTimersByTime(2999);
    expect(sources).toHaveLength(5);
    vi.advanceTimersByTime(1);
    expect(sources).toHaveLength(6);
    const restored = new window.Event("pageshow");
    Object.defineProperty(restored, "persisted", { value: true });
    window.dispatchEvent(restored);
    expect(sources[5]!.closed).toBe(true);
    expect(sources).toHaveLength(7);
    stream.close();
    window.dispatchEvent(new window.Event("online"));
    vi.advanceTimersByTime(60_000);
    expect(sources).toHaveLength(7);
    expect(sources[6]!.closed).toBe(true);
    expect(disconnected).toHaveBeenCalled();
  } finally {
    stream.close();
    vi.useRealTimers();
    Object.assign(globalThis, previous);
    void window.happyDOM.close();
  }
});
