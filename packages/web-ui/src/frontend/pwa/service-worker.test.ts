import { expect, test, vi } from "vitest";

import { installWorker } from "./service-worker";
import type { WorkerScope } from "./service-worker";

const setup = () => {
  const origin = "https://loop.example";
  const entries = new Map<string, Response>();
  const key = (request: Request | string) =>
    new URL(typeof request === "string" ? request : request.url, origin).href;
  const cache = {
    match: async (request: Request | string) => entries.get(key(request))?.clone(),
    put: vi.fn(async (request: Request | string, response: Response) => {
      entries.set(key(request), response);
    }),
  };
  const handlers = new Map<string, (event: unknown) => void>();
  const fetch = vi.fn(
    async (_request: Request) =>
      new Response("static", { headers: { "content-type": "text/javascript" } }),
  );
  const scope = {
    location: { origin },
    fetch,
    caches: {
      open: async () => cache,
      keys: async () => ["loop-static-v1-old", "other-cache"],
      delete: vi.fn(async () => true),
    },
    skipWaiting: vi.fn(async () => {}),
    clients: { claim: vi.fn(async () => {}) },
    addEventListener: (name: string, handler: (event: unknown) => void) =>
      handlers.set(name, handler),
  };
  installWorker(scope as unknown as WorkerScope, {
    version: "new",
    assets: ["/assets/app.js"],
    precache: ["/manifest.webmanifest"],
    offline: "Generic offline page",
  });
  const dispatch = (name: string, extra: object = {}) => {
    const pending: Promise<unknown>[] = [];
    let response: Promise<Response> | undefined;
    handlers.get(name)?.({
      ...extra,
      waitUntil: (promise: Promise<unknown>) => pending.push(promise),
      respondWith: (value: Promise<Response>) => {
        response = value;
      },
    });
    return {
      response,
      done: async () => {
        if (response) await response;
        await Promise.all(pending);
      },
    };
  };
  return { origin, entries, cache, scope, dispatch };
};

test("cache only allowlisted static GETs; bypass APIs, auth, queries and other origins", async () => {
  const { origin, dispatch, scope, cache } = setup();
  for (const path of [
    "/api/events",
    "/auth/login",
    "/api",
    "/auth",
    "/assets/app.js?secret=example",
    "/unknown.js",
    "https://other.example/assets/app.js",
  ]) {
    expect(
      dispatch("fetch", { request: new Request(new URL(path, origin)) }).response,
    ).toBeUndefined();
  }
  expect(
    dispatch("fetch", { request: new Request(origin + "/assets/app.js", { method: "POST" }) })
      .response,
  ).toBeUndefined();
  for (let index = 0; index < 2; index++) {
    const event = dispatch("fetch", { request: new Request(origin + "/assets/app.js") });
    expect(await (await event.response)?.text()).toBe("static");
    await event.done();
  }
  expect(scope.fetch).toHaveBeenCalledTimes(1);
  expect(cache.put).toHaveBeenCalledTimes(1);
});

test.each([401, 403, 404, 500, 200])(
  "never cache failures or an HTML login response (%s)",
  async (status) => {
    const { origin, dispatch, scope, cache } = setup();
    scope.fetch.mockResolvedValue(
      new Response("sign in", { status, headers: { "content-type": "text/html" } }),
    );
    await dispatch("fetch", { request: new Request(origin + "/assets/app.js") }).done();
    expect(cache.put).not.toHaveBeenCalled();
  },
);

test("navigation stays online and only uses generic offline fallback on network failure", async () => {
  const { origin, entries, dispatch, scope, cache } = setup();
  entries.set(origin + "/offline.html", new Response("offline"));
  const request = { url: origin + "/", method: "GET", mode: "navigate" };
  scope.fetch.mockResolvedValueOnce(new Response("auth required", { status: 401 }));
  expect((await dispatch("fetch", { request }).response)?.status).toBe(401);
  scope.fetch.mockRejectedValueOnce(new TypeError("offline"));
  expect(await (await dispatch("fetch", { request }).response)?.text()).toBe("offline");
  expect(cache.put).not.toHaveBeenCalled();
});

test("installation validates offline assets; activation and updates are scoped", async () => {
  const { origin, dispatch, scope } = setup();
  await expect(dispatch("install").done()).rejects.toThrow("Static download failed");
  scope.fetch.mockResolvedValue(
    new Response("{}", { headers: { "content-type": "application/manifest+json" } }),
  );
  await dispatch("install").done();
  expect(scope.skipWaiting).not.toHaveBeenCalled();
  await dispatch("activate").done();
  expect(scope.caches.delete).toHaveBeenCalledExactlyOnceWith("loop-static-v1-old");
  expect(scope.clients.claim).toHaveBeenCalledTimes(1);
  await dispatch("message", {
    data: { type: "ACTIVATE_UPDATE" },
    source: { url: "https://other.example" },
  }).done();
  expect(scope.skipWaiting).not.toHaveBeenCalled();
  await dispatch("message", {
    data: { type: "ACTIVATE_UPDATE" },
    source: { url: origin + "/" },
  }).done();
  expect(scope.skipWaiting).toHaveBeenCalledTimes(1);
});

test.each(["redirected", "opaque"])("never cache %s responses", async (kind) => {
  const { origin, dispatch, scope, cache } = setup();
  const response = new Response("script", { headers: { "content-type": "text/javascript" } });
  Object.defineProperty(response, kind === "opaque" ? "type" : "redirected", {
    value: kind === "opaque" ? "opaque" : true,
  });
  scope.fetch.mockResolvedValue(response);
  await dispatch("fetch", { request: new Request(origin + "/assets/app.js") }).done();
  expect(cache.put).not.toHaveBeenCalled();
});
