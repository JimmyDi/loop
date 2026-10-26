import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";

import { downloadResource } from "./download";
import type { VoiceResourceFile } from "./resource-types";

const directories: string[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "loop-voice-download-"));
  directories.push(root);
  const bytes = Buffer.from("synthetic voice resource");
  const file: VoiceResourceFile = {
    path: "model.onnx",
    url: "https://github.com/loop-test/voice/releases/download/v1/model.onnx",
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
  return { root, bytes, file, destination: join(root, "model.onnx") };
};

test("resumes partial resources only with exact range, then verifies the complete digest", async () => {
  const { bytes, file, destination } = await fixture();
  await writeFile(destination + ".partial", bytes.subarray(0, 5));
  const fetcher = vi.fn(async (_url: URL, options: RequestInit) => {
    expect(new Headers(options.headers).get("range")).toBe("bytes=5-");
    return new Response(bytes.subarray(5), {
      status: 206,
      headers: {
        "content-range": "bytes 5-" + (bytes.length - 1) + "/" + bytes.length,
        "content-length": String(bytes.length - 5),
      },
    });
  });
  vi.stubGlobal("fetch", fetcher);
  await downloadResource(file, destination, new AbortController().signal, () => {});
  expect(await readFile(destination)).toEqual(bytes);
});

test("falls back to full download when the server ignores a range", async () => {
  const { bytes, file, destination } = await fixture();
  await writeFile(destination + ".partial", bytes.subarray(0, 5));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(bytes)),
  );
  await downloadResource(file, destination, new AbortController().signal, () => {});
  expect(await readFile(destination)).toEqual(bytes);
});

test("rejects mismatched data and removes its corrupt partial file", async () => {
  const { file, destination } = await fixture();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(Buffer.alloc(file.bytes))),
  );
  await expect(
    downloadResource(file, destination, new AbortController().signal, () => {}),
  ).rejects.toThrow("integrity");
  await expect(readFile(destination + ".partial")).rejects.toMatchObject({ code: "ENOENT" });
});

test("resumes pinned Hugging Face models through its AWS CDN and verifies the digest", async () => {
  const { bytes, file, destination } = await fixture();
  file.url = "https://huggingface.co/loop-test/voice/resolve/v1/model.onnx";
  const cdnUrl = "https://us.aws.cdn.hf.co/model.onnx";
  await writeFile(destination + ".partial", bytes.subarray(0, 5));
  const fetcher = vi.fn(async (url: URL, options: RequestInit) => {
    expect(options.redirect).toBe("manual");
    expect(new Headers(options.headers).get("range")).toBe("bytes=5-");
    if (url.href === file.url) {
      return new Response(null, { status: 302, headers: { location: cdnUrl } });
    }
    expect(url.href).toBe(cdnUrl);
    return new Response(bytes.subarray(5), {
      status: 206,
      headers: {
        "content-range": "bytes 5-" + (bytes.length - 1) + "/" + bytes.length,
        "content-length": String(bytes.length - 5),
      },
    });
  });
  vi.stubGlobal("fetch", fetcher);
  await downloadResource(file, destination, new AbortController().signal, () => {});
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(await readFile(destination)).toEqual(bytes);
});

test.each([
  "https://example.test/private",
  "https://us.aws.cdn.hf.co.example.test/model.onnx",
  "https://untrusted.hf.co/model.onnx",
  "http://us.aws.cdn.hf.co/model.onnx",
  "https://user:password@us.aws.cdn.hf.co/model.onnx",
])("does not follow downloads to untrusted sources: %s", async (location) => {
  const { file, destination } = await fixture();
  const fetcher = vi.fn(async () => new Response(null, { status: 302, headers: { location } }));
  vi.stubGlobal("fetch", fetcher);
  await expect(
    downloadResource(file, destination, new AbortController().signal, () => {}),
  ).rejects.toThrow("source_rejected");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
