import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
export const downloadNativeDependency = async (url: string, path: string, expected: string) => {
  let bytes: Buffer | undefined;
  try {
    bytes = await readFile(path);
  } catch {}
  if (bytes && sha(bytes) === expected) return;
  const response = await fetch(url, { signal: AbortSignal.timeout(600_000) });
  if (!response.ok) throw new Error("Native dependency download failed");
  bytes = Buffer.from(await response.arrayBuffer());
  if (sha(bytes) !== expected) throw new Error("Native dependency integrity mismatch");
  await writeFile(path, bytes);
};
