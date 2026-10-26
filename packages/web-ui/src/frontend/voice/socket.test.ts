import { expect, test, vi } from "vitest";

import { connectVoice } from "./socket";

test("voice ticket stays out of the URL, audio pairs by generation and backpressure rejects", async () => {
  const previous = { WebSocket: globalThis.WebSocket, window: globalThis.window };
  const instances: LocalSocket[] = [];
  class LocalSocket {
    static OPEN = 1;
    readyState = 1;
    bufferedAmount = 0;
    binaryType = "";
    onopen?: () => void;
    onmessage?: (event: { data: string | ArrayBuffer }) => void;
    onclose?: () => void;
    onerror?: () => void;
    sent: unknown[] = [];
    constructor(readonly url: URL) {
      instances.push(this);
    }
    send(value: unknown) {
      this.sent.push(value);
    }
    close() {
      this.onclose?.();
    }
  }
  Object.assign(globalThis, {
    WebSocket: LocalSocket,
    window: { location: { href: "https://example.test/chat" } },
  });
  const controller = new AbortController();
  const ready = vi.fn();
  const audio = vi.fn();
  try {
    const client = connectVoice({
      connection: { callId: "call", ticket: "private-ticket", expiresAt: 1 },
      clientId: "client",
      signal: controller.signal,
      ready,
      event: vi.fn(),
      audio,
      disconnected: vi.fn(),
      failed: vi.fn(),
    });
    const socket = instances[0]!;
    expect(String(socket.url)).toBe("wss://example.test/api/voice/calls/call/socket");
    socket.onopen?.();
    expect(socket.sent).toEqual([
      JSON.stringify({ type: "authenticate", ticket: "private-ticket" }),
    ]);
    socket.onmessage?.({ data: JSON.stringify({ type: "ready", callId: "call" }) });
    expect(ready).toHaveBeenCalledOnce();
    socket.onmessage?.({
      data: JSON.stringify({ type: "audio", generation: 4, sampleRate: 16000, format: "wav" }),
    });
    const wav = new ArrayBuffer(10);
    socket.onmessage?.({ data: wav });
    expect(audio).toHaveBeenCalledWith(wav, 4);
    socket.onmessage?.({ data: wav });
    expect(audio).toHaveBeenCalledOnce();
    socket.bufferedAmount = 64_001;
    expect(client.pcm(new ArrayBuffer(640))).toBe(false);
    client.close();
  } finally {
    controller.abort();
    Object.assign(globalThis, previous);
  }
});

test("ticket refresh retries transient failure and stops on authentication failure", async () => {
  vi.useFakeTimers();
  const previous = {
    WebSocket: globalThis.WebSocket,
    window: globalThis.window,
    fetch: globalThis.fetch,
  };
  const instances: LocalSocket[] = [];
  class LocalSocket {
    static OPEN = 1;
    readyState = 1;
    bufferedAmount = 0;
    onmessage?: (event: { data: string }) => void;
    onclose?: () => void;
    constructor() {
      instances.push(this);
    }
    send() {}
    close() {
      this.onclose?.();
    }
  }
  Object.assign(globalThis, {
    WebSocket: LocalSocket,
    window: { location: { href: "https://example.test" } },
  });
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("network"))
    .mockResolvedValueOnce(Response.json({ callId: "call", ticket: "new", expiresAt: 100 }))
    .mockResolvedValueOnce(Response.json({ code: "voice_call_expired" }, { status: 404 }));
  globalThis.fetch = fetch;
  const controller = new AbortController();
  const failed = vi.fn();
  try {
    connectVoice({
      connection: { callId: "call", ticket: "initial", expiresAt: 100 },
      clientId: "client",
      signal: controller.signal,
      ready: vi.fn(),
      event: vi.fn(),
      audio: vi.fn(),
      disconnected: vi.fn(),
      failed,
    });
    instances[0]?.onmessage?.({ data: JSON.stringify({ type: "ready", callId: "call" }) });
    instances[0]?.close();
    await vi.advanceTimersByTimeAsync(2500);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(instances).toHaveLength(2);
    expect(failed).not.toHaveBeenCalled();
    instances[1]?.onmessage?.({ data: JSON.stringify({ type: "ready", callId: "call" }) });
    instances[1]?.close();
    await vi.advanceTimersByTimeAsync(500);
    expect(failed).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetch).toHaveBeenCalledTimes(3);
  } finally {
    controller.abort();
    vi.useRealTimers();
    Object.assign(globalThis, previous);
  }
});
