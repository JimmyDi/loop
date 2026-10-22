import { expect, test, vi } from "vitest";

import { remoteResponse } from "./remote-response";

test("finite and bodyless responses release their device connection exactly once", async () => {
  const release = vi.fn();
  const signal = new AbortController();
  const response = remoteResponse(Response.json({ ok: true }), signal.signal, release);
  expect(await response.json()).toEqual({ ok: true });
  expect(release).toHaveBeenCalledOnce();
  signal.abort();
  expect(release).toHaveBeenCalledOnce();
  const emptyRelease = vi.fn();
  expect(
    remoteResponse(new Response(null, { status: 204 }), signal.signal, emptyRelease).status,
  ).toBe(204);
  expect(emptyRelease).toHaveBeenCalledOnce();
});

test.each(["revoke", "cancel", "already aborted"])(
  "%s cancels the source and releases once",
  async (action) => {
    const cancelled = vi.fn();
    const release = vi.fn();
    const abort = new AbortController();
    const source = new ReadableStream({ cancel: cancelled });
    if (action === "already aborted") abort.abort();
    const response = remoteResponse(new Response(source), abort.signal, release);
    const reader = response.body!.getReader();
    if (action === "cancel") await reader.cancel();
    else {
      abort.abort();
      expect((await reader.read()).done).toBe(true);
    }
    expect(cancelled).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
  },
);
