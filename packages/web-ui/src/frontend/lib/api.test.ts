import { expect, test, vi } from "vitest";

import { api, ApiError } from "./api";

test("HTTP errors preserve status and machine-readable code", async () => {
  const original = globalThis.fetch;

  try {
    globalThis.fetch = (async () =>
      Response.json(
        { code: "session_busy", message: "Busy" },
        { status: 409 },
      )) as unknown as typeof fetch;
    const error = await api("/sessions").catch((error) => error);

    expect(error).toBeInstanceOf(ApiError);

    if (!(error instanceof ApiError)) throw new Error("Expected API error");

    expect(error.code).toBe("session_busy");
    expect(error.status).toBe(409);
  } finally {
    globalThis.fetch = original;
  }
});

test("stalled prompt requests time out and abort without claiming rejection", async () => {
  const original = globalThis.fetch;
  let signal: AbortSignal | undefined;
  vi.useFakeTimers();
  globalThis.fetch = (async (_url, init) => {
    signal = init?.signal ?? undefined;
    return new Promise<Response>(() => {});
  }) as typeof fetch;
  try {
    const pending = api("/sessions/example/prompt", { method: "POST", body: "{}" }).catch(
      (error) => error,
    );
    await vi.advanceTimersByTimeAsync(30_000);
    const error = await pending;
    expect(error).not.toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("timed out");
    expect(signal?.aborted).toBe(true);
  } finally {
    globalThis.fetch = original;
    vi.useRealTimers();
  }
});
