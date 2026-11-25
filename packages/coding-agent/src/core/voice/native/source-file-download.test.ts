import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, expect, test, vi } from "vitest";
import { downloadSourceFile } from "./source-file-download";
import type { SourceLockFile } from "./source-lock-types";

vi.mock("node:timers/promises", () => ({ setTimeout: vi.fn(async () => {}) }));

const data = Buffer.from("synthetic source\n");
const revision = "1".repeat(40);
const file: SourceLockFile = [
  "include/runtime.h",
  data.length,
  createHash("sha1")
    .update("blob " + data.length + "\0")
    .update(data)
    .digest("hex"),
  createHash("sha256").update(data).digest("hex"),
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

test("retries network failures with exponential backoff and preserves the verified bytes", async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("fetch failed", { cause: { code: "ECONNRESET" } }))
    .mockResolvedValueOnce(new Response(data));
  vi.stubGlobal("fetch", fetcher);
  const signal = new AbortController().signal;
  expect(await downloadSourceFile(revision, file, signal)).toEqual(data);
  expect(delay).toHaveBeenCalledWith(1_000, undefined, { signal });
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test.each([408, 429, 500, 503])("retries HTTP %i with Retry-After", async (status) => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response("retry", { status, headers: { "Retry-After": "3" } }))
    .mockResolvedValueOnce(new Response(data));
  vi.stubGlobal("fetch", fetcher);
  const signal = new AbortController().signal;
  expect(await downloadSourceFile(revision, file, signal)).toEqual(data);
  expect(delay).toHaveBeenCalledWith(3_000, undefined, { signal });
});

test("reports the path, revision and original network cause after bounded retries", async () => {
  const cause = new TypeError("fetch failed", { cause: { code: "ECONNRESET" } });
  const fetcher = vi.fn().mockRejectedValue(cause);
  vi.stubGlobal("fetch", fetcher);
  await expect(
    downloadSourceFile(revision, file, new AbortController().signal),
  ).rejects.toMatchObject({
    message: "ORT source download failed for include/runtime.h at " + revision,
    cause,
  });
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(vi.mocked(delay).mock.calls.map(([wait]) => wait)).toEqual([1_000, 2_000, 4_000]);
});

test.each([401, 403, 404])("fails HTTP %i immediately and closes its response", async (status) => {
  const cancel = vi.fn();
  const response = new Response(new ReadableStream({ cancel }), { status });
  const fetcher = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetcher);
  await expect(
    downloadSourceFile(revision, file, new AbortController().signal),
  ).rejects.toMatchObject({ cause: { message: "HTTP " + status } });
  expect(fetcher).toHaveBeenCalledOnce();
  expect(cancel).toHaveBeenCalledOnce();
  expect(delay).not.toHaveBeenCalled();
});

test("rejects oversized content without reading the remaining response", async () => {
  const cancel = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(Buffer.alloc(data.length + 1));
          },
          cancel,
        }),
      ),
    ),
  );
  await expect(
    downloadSourceFile(revision, file, new AbortController().signal),
  ).rejects.toMatchObject({ cause: { message: "Source integrity mismatch (size)" } });
  expect(cancel).toHaveBeenCalledOnce();
  expect(delay).not.toHaveBeenCalled();
});

test("cancellation during backoff prevents further requests", async () => {
  const controller = new AbortController();
  vi.mocked(delay).mockImplementationOnce(async () => {
    controller.abort(new Error("Stopped"));
  });
  const fetcher = vi.fn().mockRejectedValue(new Error("network unavailable"));
  vi.stubGlobal("fetch", fetcher);
  await expect(downloadSourceFile(revision, file, controller.signal)).rejects.toThrow("Stopped");
  expect(fetcher).toHaveBeenCalledOnce();
});
