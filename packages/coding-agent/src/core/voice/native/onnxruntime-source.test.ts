import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { downloadOnnxruntimeSource } from "./onnxruntime-source";
import type { SourceLock } from "./source-lock-types";

const directories: string[] = [];

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const fixture = async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-voice-source-"));
  directories.push(directory);
  const data = Buffer.from("synthetic upstream source\n");
  const lock: SourceLock = {
    version: 1,
    revision: "1".repeat(40),
    files: [
      [
        "include/runtime.h",
        data.length,
        createHash("sha1")
          .update("blob " + data.length + "\0")
          .update(data)
          .digest("hex"),
        createHash("sha256").update(data).digest("hex"),
      ],
    ],
  };
  return { directory, data, lock };
};

test("downloads verified nested source files, reuses the cache, and repairs changed content", async () => {
  const { directory, data, lock } = await fixture();
  const fetcher = vi.fn(async () => new Response(data));
  vi.stubGlobal("fetch", fetcher);
  await downloadOnnxruntimeSource(directory, lock);
  const target = join(directory, lock.files[0]![0]);
  expect(await readFile(target)).toEqual(data);
  await downloadOnnxruntimeSource(directory, lock);
  expect(fetcher).toHaveBeenCalledOnce();
  const corrupt = Buffer.alloc(data.length);
  await writeFile(target, corrupt);
  await downloadOnnxruntimeSource(directory, lock);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(await readFile(target)).toEqual(data);
});

test.each(["size", "sha256", "git-blob-sha1"] as const)(
  "rejects downloaded source with a mismatched %s before writing it",
  async (mismatch) => {
    const { directory, data, lock } = await fixture();
    const file = lock.files[0]!;
    if (mismatch === "size") file[1]++;
    else if (mismatch === "sha256") file[3] = "0".repeat(64);
    else file[2] = "0".repeat(40);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(data)),
    );
    await expect(downloadOnnxruntimeSource(directory, lock)).rejects.toThrow("integrity");
    await expect(stat(join(directory, file[0]))).rejects.toMatchObject({ code: "ENOENT" });
  },
);

test.each(["../escaped.h", "include/../../escaped.h", "include\\escaped.h"])(
  "rejects the source lock path %s before downloading",
  async (path) => {
    const { directory, lock } = await fixture();
    lock.files[0]![0] = path;
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(downloadOnnxruntimeSource(directory, lock)).rejects.toThrow("lock path");
    expect(fetcher).not.toHaveBeenCalled();
  },
);

test.each(["version", "revision", "duplicate-path"] as const)(
  "rejects invalid %s metadata before any download",
  async (invalid) => {
    const { directory, lock } = await fixture();
    if (invalid === "version") lock.version = 2;
    else if (invalid === "revision") lock.revision = "main";
    else lock.files.push([...lock.files[0]!]);
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(downloadOnnxruntimeSource(directory, lock)).rejects.toThrow("metadata");
    expect(fetcher).not.toHaveBeenCalled();
  },
);
