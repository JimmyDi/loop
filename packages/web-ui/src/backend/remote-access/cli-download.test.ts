import { mkdtemp, open, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";

import { CliDownload } from "./cli-download";

afterEach(() => vi.unstubAllGlobals());

test.each([true, false])(
  "pause aborts transfer; resume retains bytes when Range supported=%s",
  async (ranges) => {
    const directory = await mkdtemp(join(tmpdir(), "loop-transfer-test-"));
    const file = join(directory, "partial.download");
    const handle = await open(file, "wx");
    const abort = new AbortController();
    const progress = vi.fn();
    const fetcher = vi.fn(async (_url: string, options: RequestInit) => {
      if (fetcher.mock.calls.length === 1) {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array([1, 2]));
            options.signal!.addEventListener(
              "abort",
              () => controller.error(options.signal!.reason),
              { once: true },
            );
          },
        });
        return new Response(stream, { headers: { "Content-Length": "4", ETag: '"synthetic"' } });
      }
      return ranges
        ? new Response(new Uint8Array([3, 4]), {
            status: 206,
            headers: { "Content-Range": "bytes 2-3/4" },
          })
        : new Response(new Uint8Array([1, 2, 3, 4]), { headers: { "Content-Length": "4" } });
    });
    vi.stubGlobal("fetch", fetcher);
    const download = new CliDownload("https://example.test/cli", handle, abort.signal, progress);
    const running = download.run();
    try {
      await vi.waitFor(() =>
        expect(progress).toHaveBeenLastCalledWith({ received: 2, total: 4, paused: false }),
      );
      expect(download.pause(true)).toBe(true);
      expect(download.pause(true)).toBe(false);
      expect(await readFile(file)).toEqual(Buffer.from([1, 2]));
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(fetcher).toHaveBeenCalledOnce();
      expect(progress).toHaveBeenLastCalledWith({ received: 2, total: 4, paused: true });
      expect(download.pause(false)).toBe(true);
      await running;
      expect(fetcher.mock.calls[1]![1].headers).toMatchObject({
        Range: "bytes=2-",
        "If-Range": '"synthetic"',
        "x-ms-version": "2023-11-03",
      });
      expect(await readFile(file)).toEqual(Buffer.from([1, 2, 3, 4]));
      expect(download.pause(true)).toBe(false);
    } finally {
      abort.abort();
      await running.catch(() => {});
      await handle.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);

test("real HTTP pause closes the connection and resume requests only the remaining bytes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-http-download-test-"));
  const file = join(directory, "partial.download");
  const handle = await open(file, "wx");
  const abort = new AbortController();
  const requests: (string | undefined)[] = [];
  const versions: (string | string[] | undefined)[] = [];
  let disconnected = false;
  let completed = false;
  const server = createServer((request, response) => {
    requests.push(request.headers.range);
    versions.push(request.headers["x-ms-version"]);
    if (
      request.headers.range &&
      request.headers["x-ms-version"] === "2023-11-03" &&
      request.headers["if-range"] === '"synthetic"'
    ) {
      response.writeHead(206, { "Content-Range": "bytes 2-3/4", "Content-Length": "2" });
      response.end(Buffer.from([3, 4]));
      return;
    }
    response.writeHead(200, { "Content-Length": "4", ETag: '"synthetic"' });
    response.write(Buffer.from([1, 2]));
    response.once("close", () => {
      disconnected = true;
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test listener");
  const progress = vi.fn();
  const download = new CliDownload(
    "http://127.0.0.1:" + address.port,
    handle,
    abort.signal,
    progress,
  );
  const running = download.run().then(() => {
    completed = true;
  });
  try {
    await vi.waitFor(() =>
      expect(progress).toHaveBeenLastCalledWith({ received: 2, total: 4, paused: false }),
    );
    download.pause(true);
    await vi.waitFor(() => expect(disconnected).toBe(true));
    expect(completed).toBe(false);
    expect(requests).toEqual([undefined]);
    download.pause(false);
    await running;
    expect(requests).toEqual([undefined, "bytes=2-"]);
    expect(versions).toEqual(["2023-11-03", "2023-11-03"]);
    expect(await readFile(file)).toEqual(Buffer.from([1, 2, 3, 4]));
  } finally {
    abort.abort();
    await running.catch(() => {});
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await handle.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test.each(["bytes 0-1/4", "bytes 2-3/8", "invalid", "bytes 2-3/104857601"])(
  "rejects invalid resumed range %s",
  async (range) => {
    const directory = await mkdtemp(join(tmpdir(), "loop-range-test-"));
    const handle = await open(join(directory, "partial.download"), "wx");
    const abort = new AbortController();
    let first = true;
    let pausedOnce = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        if (!first)
          return new Response(new Uint8Array([3, 4]), {
            status: 206,
            headers: { "Content-Range": range },
          });
        first = false;
        return new Response(new Uint8Array([1, 2]), { headers: { "Content-Length": "4" } });
      }),
    );
    const download = new CliDownload("https://example.test/cli", handle, abort.signal, (value) => {
      if (pausedOnce || first || value.received !== 2 || value.paused) return;
      pausedOnce = true;
      download.pause(true);
    });
    const running = download.run();
    try {
      await vi.waitFor(() => expect(pausedOnce).toBe(true));
      download.pause(false);
      await expect(running).rejects.toThrow();
    } finally {
      abort.abort();
      await running.catch(() => {});
      await handle.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
