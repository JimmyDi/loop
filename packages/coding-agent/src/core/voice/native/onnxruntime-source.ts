import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { downloadSourceFile } from "./source-file-download";
import type { SourceLock } from "./source-lock-types";

export const downloadOnnxruntimeSource = async (
  directory: string,
  lock: SourceLock,
): Promise<void> => {
  if (
    lock.version !== 1 ||
    !/^[a-f0-9]{40}$/.test(lock.revision) ||
    !Array.isArray(lock.files) ||
    new Set(lock.files.map((file) => file?.[0])).size !== lock.files.length ||
    lock.files.some(
      (file) =>
        !Array.isArray(file) ||
        file.length !== 4 ||
        typeof file[0] !== "string" ||
        !/^[a-zA-Z0-9_.@+-]+(?:\/[a-zA-Z0-9_.@+-]+)*$/.test(file[0]) ||
        file[0].split("/").some((part) => part === "." || part === "..") ||
        !Number.isSafeInteger(file[1]) ||
        file[1] < 0 ||
        file[1] > 32 * 1024 * 1024 ||
        !/^[a-f0-9]{40}$/.test(file[2]) ||
        !/^[a-f0-9]{64}$/.test(file[3]),
    )
  )
    throw new Error("Invalid ORT source lock path or metadata");
  const controller = new AbortController();
  let next = 0;
  const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
  const worker = async () => {
    while (next < lock.files.length) {
      controller.signal.throwIfAborted();
      const file = lock.files[next++]!;
      const [path, bytes, , digest] = file;
      const target = join(directory, path);
      let data: Buffer | undefined;
      try {
        data = await readFile(target);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      if (data?.length === bytes && sha256(data) === digest) continue;
      data = await downloadSourceFile(lock.revision, file, controller.signal);
      controller.signal.throwIfAborted();
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, data);
    }
  };
  const workers = Array.from({ length: 8 }, async () => {
    try {
      await worker();
    } catch (error) {
      controller.abort(error);
      throw error;
    }
  });
  await Promise.allSettled(workers);
  controller.signal.throwIfAborted();
};
