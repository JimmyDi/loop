import type { Server } from "node:http";
import { fileURLToPath } from "node:url";
import type { ViteDevServer } from "vite";

import { staticResponse } from "./static-files";

const retryDelay = 2000;

export const developmentResponse = async (request: Request, assetsDir: string) => {
  const response = await staticResponse(request, assetsDir);
  if (response.status !== 404 || !["/", "/index.html"].includes(new URL(request.url).pathname))
    return response;

  return new Response(
    request.method === "HEAD"
      ? null
      : `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="3"><title>Loop</title>
<style>:root{color-scheme:light dark}body{font:16px system-ui;max-width:36rem;margin:15vh auto;padding:24px}</style>
</head><body><h1>Loop frontend is unavailable</h1>
<p>The server is still running. Check the terminal for frontend errors.</p>
<p>Fix the frontend configuration. This page retries automatically.</p></body></html>`,
    {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Retry-After": "3",
      },
    },
  );
};

export const createDevelopmentFrontend = async (
  server: Server,
  configFile = fileURLToPath(new URL("../../../vite.config.ts", import.meta.url)),
) => {
  let vite: ViteDevServer | undefined;
  let pending: Promise<void> | undefined;
  let retryAt = 0;
  let closed = false;

  const load = async () => {
    if (closed || vite) return;
    if (pending) return pending;
    if (Date.now() < retryAt) return;

    pending = (async () => {
      try {
        const { createServer } = await import("vite");
        vite = await createServer({
          configLoader: "runner",
          configFile,
          server: { middlewareMode: true, hmr: { server } },
          appType: "spa",
        });
      } catch (error) {
        retryAt = Date.now() + retryDelay;
        console.error("Frontend development failed; the Loop API remains available.", error);
      }
    })();
    try {
      await pending;
    } finally {
      pending = undefined;
    }
  };

  await load();
  const handler = server.listeners("request")[0]!;
  server.removeAllListeners("request");
  server.on("request", (request, response) => {
    const fallback = () => handler.call(server, request, response);
    if (request.url?.startsWith("/api/")) {
      fallback();
      return;
    }
    void load().then(() => {
      if (closed || response.destroyed) return;
      if (vite) vite.middlewares(request, response, fallback);
      else fallback();
    });
  });

  return {
    async close() {
      closed = true;
      await pending;
      await vite?.close();
    },
  };
};
