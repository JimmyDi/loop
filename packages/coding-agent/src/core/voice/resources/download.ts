import { createHash } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import { lstat, open, rename, unlink } from "node:fs/promises";

import type { VoiceResourceFile } from "./resource-types";

export const hashFile = async (file: string, signal?: AbortSignal): Promise<string> => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file, { signal })) hash.update(chunk);
  return hash.digest("hex");
};

export const matchesResource = async (
  path: string,
  file: Pick<VoiceResourceFile, "bytes" | "sha256">,
): Promise<boolean> => {
  try {
    const stat = await lstat(path);
    return (
      stat.isFile() &&
      !stat.isSymbolicLink() &&
      stat.size === file.bytes &&
      (await hashFile(path)) === file.sha256
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
};

const trustedDownload = (url: URL): boolean =>
  url.protocol === "https:" &&
  !url.username &&
  !url.password &&
  [
    "huggingface.co",
    "cdn-lfs.huggingface.co",
    "cdn-lfs-us-1.hf.co",
    "us.aws.cdn.hf.co",
    "cas-bridge.xethub.hf.co",
    "github.com",
    "raw.githubusercontent.com",
    "release-assets.githubusercontent.com",
    "objects.githubusercontent.com",
  ].includes(url.hostname);

const fetchResource = async (
  url: string,
  headers: Headers,
  signal: AbortSignal,
): Promise<Response> => {
  let next = new URL(url);
  for (let redirect = 0; redirect < 6; redirect++) {
    if (!trustedDownload(next)) throw new Error("voice_download_source_rejected");
    const result = await fetch(next, { headers, signal, redirect: "manual" });
    if (![301, 302, 303, 307, 308].includes(result.status)) return result;
    const location = result.headers.get("location");
    await result.body?.cancel();
    if (!location) throw new Error("voice_download_failed");
    next = new URL(location, next);
  }
  throw new Error("voice_download_redirect_limit");
};

export const downloadResource = async (
  resource: VoiceResourceFile,
  destination: string,
  signal: AbortSignal,
  progress: (received: number) => void,
): Promise<void> => {
  const partial = destination + ".partial";
  try {
    if (!(await lstat(partial)).isFile()) throw new Error("voice_resource_path_invalid");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const handle = await open(
    partial,
    constants.O_APPEND | constants.O_CREAT | constants.O_RDWR | (constants.O_NOFOLLOW ?? 0),
    0o600,
  );
  try {
    let received = (await handle.stat()).size;
    if (received > resource.bytes) {
      await handle.truncate(0);
      received = 0;
    }
    if (received < resource.bytes) {
      const headers = new Headers({ "Accept-Encoding": "identity" });
      if (received) headers.set("Range", "bytes=" + received + "-");
      const response = await fetchResource(resource.url, headers, signal);
      if (response.status === 200) {
        await handle.truncate(0);
        received = 0;
      } else if (response.status === 206) {
        const expected = "bytes " + received + "-" + (resource.bytes - 1) + "/" + resource.bytes;
        if (!received || response.headers.get("content-range") !== expected) {
          await response.body?.cancel();
          throw new Error("voice_download_range_invalid");
        }
      } else {
        await response.body?.cancel();
        throw new Error("voice_download_failed");
      }
      const length = response.headers.get("content-length");
      if (length !== null && Number(length) !== resource.bytes - received) {
        await response.body?.cancel();
        throw new Error("voice_download_size_invalid");
      }
      if (!response.body) throw new Error("voice_download_failed");
      const reader = response.body.getReader();
      try {
        while (true) {
          signal.throwIfAborted();
          const chunk = await reader.read();
          if (chunk.done) break;
          if (received + chunk.value.length > resource.bytes)
            throw new Error("voice_download_size_invalid");
          await handle.writeFile(chunk.value);
          received += chunk.value.length;
          progress(received);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      if (received !== resource.bytes) throw new Error("voice_download_incomplete");
    }
    await handle.sync();
  } finally {
    await handle.close();
  }
  if ((await hashFile(partial, signal)) !== resource.sha256) {
    await unlink(partial);
    throw new Error("voice_resource_integrity_failed");
  }
  signal.throwIfAborted();
  await rename(partial, destination);
};
