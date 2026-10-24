type WorkerEvent = {
  request: Request;
  source?: { url?: string };
  data?: { type?: string };
  waitUntil(promise: Promise<unknown>): void;
  respondWith(promise: Promise<Response>): void;
};

export type WorkerScope = {
  location: { origin: string };
  caches: CacheStorage;
  fetch(request: Request): Promise<Response>;
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  addEventListener(type: string, callback: (event: WorkerEvent) => void): void;
};

export type WorkerConfig = {
  version: string;
  assets: string[];
  precache: string[];
  offline: string;
};

// Self-contained: the build plugin serializes this function into the root-scoped worker.
export const installWorker = (scope: WorkerScope, config: WorkerConfig): void => {
  const prefix = "loop-static-v1-";
  const cacheName = prefix + config.version;
  const assets = new Set(config.assets);
  const usable = (request: Request, response: Response): boolean => {
    if (response.status !== 200 || response.redirected || response.type === "opaque") return false;
    const path = new URL(request.url).pathname;
    const mime = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (path.endsWith(".js")) return ["text/javascript", "application/javascript"].includes(mime);
    if (path.endsWith(".css")) return mime === "text/css";
    if (path.endsWith(".webmanifest")) return mime === "application/manifest+json";
    return mime.startsWith("image/") || mime.startsWith("font/");
  };

  scope.addEventListener("install", (event) => {
    event.waitUntil(
      (async () => {
        const cache = await scope.caches.open(cacheName);
        await cache.put(
          new Request(scope.location.origin + "/offline.html"),
          new Response(config.offline, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
        );
        for (const path of config.precache) {
          const request = new Request(scope.location.origin + path, { cache: "reload" });
          const response = await scope.fetch(request);
          if (!usable(request, response)) throw new Error("Static download failed");
          await cache.put(request, response);
        }
      })(),
    );
  });

  scope.addEventListener("activate", (event) => {
    event.waitUntil(
      (async () => {
        for (const name of await scope.caches.keys()) {
          if (name.startsWith(prefix) && name !== cacheName) await scope.caches.delete(name);
        }
        await scope.clients.claim();
      })(),
    );
  });

  scope.addEventListener("message", (event) => {
    if (
      event.data?.type === "ACTIVATE_UPDATE" &&
      event.source?.url &&
      new URL(event.source.url).origin === scope.location.origin
    )
      event.waitUntil(scope.skipWaiting());
  });

  scope.addEventListener("fetch", (event) => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== "GET" || url.origin !== scope.location.origin) return;
    if (/^\/(?:api|auth)(?:\/|$)/.test(url.pathname)) return;
    if (request.mode === "navigate") {
      // Private relay navigation can leave this origin for an interactive sign-in.
      // Preserve the browser's navigation and cookie context throughout that flow.
      if (url.hostname.endsWith(".devtunnels.ms")) return;
      event.respondWith(
        scope.fetch(request).catch(async () => {
          const cache = await scope.caches.open(cacheName);
          return (await cache.match("/offline.html")) ?? new Response(null, { status: 503 });
        }),
      );
      return;
    }
    if (url.search || !assets.has(url.pathname)) return;
    event.respondWith(
      (async () => {
        const cache = await scope.caches.open(cacheName);
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await scope.fetch(request);
        if (usable(request, response)) event.waitUntil(cache.put(request, response.clone()));
        return response;
      })(),
    );
  });
};
