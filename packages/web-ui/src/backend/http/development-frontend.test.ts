import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, vi } from "vitest";

import { createDevelopmentFrontend, developmentResponse } from "./development-frontend";
import { createHttpServer, listen } from "./node-server";

test("invalid Vite configuration preserves APIs, streams and built pages and recovers in place", async () => {
  const directory = await mkdtemp(join(import.meta.dirname, "development-fixture-"));
  const assets = join(directory, "built");
  const configFile = join(directory, "vite.config.mts");
  const pluginFile = join(directory, "plugin.mjs");
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const output = vi.spyOn(console, "log").mockImplementation(() => {});
  let stream: ReadableStreamDefaultController<Uint8Array> | undefined;
  const server = createHttpServer((request) => {
    if (new URL(request.url).pathname === "/api/events") {
      return new Response(
        new ReadableStream({
          start(controller) {
            stream = controller;
            controller.enqueue(new TextEncoder().encode("data: before\n\n"));
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      );
    }
    if (new URL(request.url).pathname.startsWith("/api/")) return Response.json({ ready: true });
    return developmentResponse(request, assets);
  });
  let frontend: Awaited<ReturnType<typeof createDevelopmentFrontend>> | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    await mkdir(assets);
    await writeFile(join(assets, "index.html"), "<h1>Last built frontend</h1>");
    await writeFile(join(directory, "index.html"), "<h1>Development frontend</h1>");
    await writeFile(pluginFile, "export const label = ;");
    await writeFile(
      configFile,
      'import { label } from "./plugin.mjs"; export default { root: import.meta.dirname, optimizeDeps: { noDiscovery: true, include: [] }, plugins: [{ name: "fixture", transformIndexHtml: (html) => html + label }] };',
    );
    frontend = await createDevelopmentFrontend(server, configFile);
    const url = await listen(server, 0);
    expect(await (await fetch(new URL("api/status", url))).json()).toEqual({ ready: true });
    expect(await (await fetch(url)).text()).toContain("Last built frontend");
    expect(errors).toHaveBeenCalled();
    const response = await fetch(new URL("api/events", url));
    reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toBe("data: before\n\n");

    await writeFile(pluginFile, 'export const label = "Recovered configuration";');
    await expect
      .poll(async () => (await fetch(url)).text(), { timeout: 10000, interval: 250 })
      .toContain("Recovered configuration");

    errors.mockClear();
    await writeFile(pluginFile, "export const label = ;");
    await expect
      .poll(
        () =>
          errors.mock.calls.some(([message]) => String(message).includes("server restart failed")),
        { timeout: 10000 },
      )
      .toBe(true);
    expect(await (await fetch(new URL("api/status", url))).json()).toEqual({ ready: true });
    expect(await (await fetch(url)).text()).toContain("Recovered configuration");
    await writeFile(pluginFile, 'export const label = "Recovered after hot reload";');
    await expect
      .poll(async () => (await fetch(url)).text(), { timeout: 10000, interval: 250 })
      .toContain("Recovered after hot reload");
    expect(server.listening).toBe(true);
    stream!.enqueue(new TextEncoder().encode("data: after\n\n"));
    expect(new TextDecoder().decode((await reader.read()).value)).toBe("data: after\n\n");
    stream!.close();
    expect((await reader.read()).done).toBe(true);
  } finally {
    await reader?.cancel();
    await frontend?.close();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
    errors.mockRestore();
    output.mockRestore();
    await rm(directory, { recursive: true, force: true });
  }
});

test("missing builds show a retrying unavailable page without masking missing assets or methods", async () => {
  const directory = await mkdtemp(join(import.meta.dirname, ".development-test-"));
  try {
    for (const method of ["GET", "HEAD"]) {
      const response = await developmentResponse(
        new Request("http://localhost/", { method }),
        directory,
      );
      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("retry-after")).toBe("3");
      const html = await response.text();
      if (method === "GET") {
        expect(html).toContain("The server is still running");
        expect(html).toContain('http-equiv="refresh"');
      } else expect(html).toBe("");
    }
    expect(
      (await developmentResponse(new Request("http://localhost/missing.js"), directory)).status,
    ).toBe(404);
    expect(
      (await developmentResponse(new Request("http://localhost/", { method: "POST" }), directory))
        .status,
    ).toBe(405);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
