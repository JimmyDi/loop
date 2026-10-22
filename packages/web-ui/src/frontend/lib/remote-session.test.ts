import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import { api, command } from "./api";
import {
  remoteCsrfHeaders,
  setRemoteCsrf,
  setBootstrapSession,
  takeBootstrapSession,
} from "./remote-session";

test("CSRF credentials stay in memory and are sent only for remote mutations", async () => {
  const window = new Window({ url: "https://example.test/" });
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
    Event: globalThis.Event,
  };
  Object.assign(globalThis, { window, document: window.document, Event: window.Event });
  const fetcher = vi.fn(async () => Response.json({}));
  globalThis.fetch = fetcher;
  try {
    setRemoteCsrf("synthetic-csrf");
    expect(remoteCsrfHeaders("POST")).toEqual({});
    window.document.head.innerHTML = '<meta name="loop-remote" content="1">';
    expect(remoteCsrfHeaders()).toEqual({});
    expect(remoteCsrfHeaders("HEAD")).toEqual({});
    await command("/sessions", {});
    expect(fetcher).toHaveBeenCalledWith(
      "/api/sessions",
      expect.objectContaining({
        headers: { "Content-Type": "application/json", "X-Loop-CSRF": "synthetic-csrf" },
      }),
    );
    expect(window.localStorage.length).toBe(0);
    const check = vi.fn();
    window.addEventListener("loop-remote-check", check);
    fetcher.mockResolvedValue(new Response(null, { status: 401 }));
    await expect(api("/workspaces")).rejects.toMatchObject({ status: 401 });
    expect(check).toHaveBeenCalledOnce();
    setRemoteCsrf();
    expect(remoteCsrfHeaders("POST")).toEqual({});
  } finally {
    setRemoteCsrf();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("bootstrap authorization is consumed once and retains its original check time", () => {
  const checkedAt = Date.now();
  setBootstrapSession({ mode: "remote", authorized: false });
  const result = takeBootstrapSession();
  expect(result?.session).toEqual({ mode: "remote", authorized: false });
  expect(result?.checkedAt).toBeGreaterThanOrEqual(checkedAt);
  expect(takeBootstrapSession()).toBeUndefined();
});
