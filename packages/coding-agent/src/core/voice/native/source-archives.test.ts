import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { pack } from "tar-stream";
import { afterEach, expect, test, vi } from "vitest";
import { unpackSourceArchive, verifiedSourceArchive } from "./source-archives";

const directories: string[] = [];

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const fixture = async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-voice-source-archive-"));
  directories.push(directory);
  return directory;
};

const sourceTar = async (name: string, data: string): Promise<Buffer> => {
  const archive = pack();
  const chunks: Buffer[] = [];
  archive.on("data", (chunk) => chunks.push(chunk as Buffer));
  const completed = new Promise<void>((yes, no) => {
    archive.once("end", yes);
    archive.once("error", no);
  });
  archive.entry({ name }, data);
  archive.finalize();
  await completed;
  return gzipSync(Buffer.concat(chunks));
};

test("verifies downloaded archives and reuses only matching cached bytes", async () => {
  const directory = await fixture();
  const data = await sourceTar("source/include/runtime.h", "synthetic header\n");
  const sha256 = createHash("sha256").update(data).digest("hex");
  const fetcher = vi.fn(async () => new Response(new Uint8Array(data)));
  vi.stubGlobal("fetch", fetcher);
  const path = await verifiedSourceArchive(
    directory,
    "source.tar.gz",
    "https://example.com/source.tar.gz",
    sha256,
  );
  expect(await readFile(path)).toEqual(data);
  await verifiedSourceArchive(
    directory,
    "source.tar.gz",
    "https://example.com/source.tar.gz",
    sha256,
  );
  expect(fetcher).toHaveBeenCalledOnce();
  await writeFile(path, "changed archive");
  await verifiedSourceArchive(
    directory,
    "source.tar.gz",
    "https://example.com/source.tar.gz",
    sha256,
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
  const source = await unpackSourceArchive(path, join(directory, "unpacked"));
  expect(await readFile(join(source, "include/runtime.h"), "utf8")).toBe("synthetic header\n");
});

test("does not promote an archive whose downloaded digest differs", async () => {
  const directory = await fixture();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("changed upstream archive")),
  );
  await expect(
    verifiedSourceArchive(
      directory,
      "source.tar.gz",
      "https://example.com/source.tar.gz",
      "0".repeat(64),
    ),
  ).rejects.toThrow("integrity mismatch");
  await expect(stat(join(directory, "source.tar.gz"))).rejects.toMatchObject({ code: "ENOENT" });
});

test.each(["parent", "nested-parent", "backslash", "absolute"])(
  "rejects a %s tar path before creating an escaped file",
  async (kind) => {
    const directory = await fixture();
    const escaped = join(directory, "escaped.txt");
    const names: Record<string, string> = {
      parent: "../escaped.txt",
      "nested-parent": "source/../../escaped.txt",
      backslash: "source\\..\\escaped.txt",
      absolute: escaped,
    };
    const archive = join(directory, "source.tar.gz");
    await writeFile(archive, await sourceTar(names[kind]!, "synthetic source"));
    await expect(unpackSourceArchive(archive, join(directory, "unpacked"))).rejects.toThrow(
      "path rejected",
    );
    await expect(stat(escaped)).rejects.toMatchObject({ code: "ENOENT" });
  },
);
