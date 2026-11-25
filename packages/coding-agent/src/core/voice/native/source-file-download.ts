import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { SourceLockFile } from "./source-lock-types";

const retryDelay = (value: string | null, attempt: number): number => {
  const seconds = Number(value);
  const requested = Number.isFinite(seconds)
    ? seconds * 1_000
    : Date.parse(value ?? "") - Date.now();
  return Math.min(60_000, Math.max(1_000 * 2 ** attempt, requested || 0));
};

export const downloadSourceFile = async (
  revision: string,
  file: SourceLockFile,
  signal: AbortSignal,
): Promise<Buffer> => {
  const [path, bytes, blob, digest] = file;
  // Intel retains the pinned upstream commit. Every file must match the reviewed source lock.
  const url = "https://raw.githubusercontent.com/intel/onnxruntime/" + revision + "/" + path;
  let failure: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    signal.throwIfAborted();
    let retryable = true;
    let wait = retryDelay(null, attempt);
    try {
      const response = await fetch(url, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]),
      });
      if (!response.ok) {
        retryable = [408, 429].includes(response.status) || response.status >= 500;
        wait = retryDelay(response.headers.get("retry-after"), attempt);
        await response.body?.cancel();
        throw new Error("HTTP " + response.status);
      }
      if (!response.body) throw new Error("Empty response body");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          length += chunk.value.length;
          if (length > bytes) {
            retryable = false;
            throw new Error("Source integrity mismatch (size)");
          }
          chunks.push(chunk.value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      const data = Buffer.concat(chunks);
      retryable = false;
      if (data.length !== bytes) throw new Error("Source integrity mismatch (size)");
      if (createHash("sha256").update(data).digest("hex") !== digest)
        throw new Error("Source integrity mismatch (sha256)");
      if (
        createHash("sha1")
          .update("blob " + data.length + "\0")
          .update(data)
          .digest("hex") !== blob
      )
        throw new Error("Source integrity mismatch (git-blob-sha1)");
      signal.throwIfAborted();
      return data;
    } catch (error) {
      signal.throwIfAborted();
      failure = error;
      if (!retryable || attempt === 3) break;
    }
    await delay(wait, undefined, { signal });
  }
  throw new Error("ORT source download failed for " + path + " at " + revision, {
    cause: failure,
  });
};
