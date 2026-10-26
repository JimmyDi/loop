import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
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
  let next = 0;
  const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
  const worker = async () => {
    while (next < lock.files.length) {
      const [path, bytes, blob, digest] = lock.files[next++]!;
      if (
        !/^[a-zA-Z0-9_.@+-]+(?:\/[a-zA-Z0-9_.@+-]+)*$/.test(path) ||
        path.split("/").includes("..")
      )
        throw new Error("Invalid ORT source lock path");
      const target = join(directory, path);
      let data: Buffer | undefined;
      try {
        data = await readFile(target);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      if (data?.length === bytes && sha256(data) === digest) continue;
      let valid = false;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const response = await fetch(
            "https://raw.githubusercontent.com/microsoft/onnxruntime/" + lock.revision + "/" + path,
            { signal: AbortSignal.timeout(60_000) },
          );
          if (!response.ok) continue;
          data = Buffer.from(await response.arrayBuffer());
          if (
            data.length !== bytes ||
            sha256(data) !== digest ||
            createHash("sha1")
              .update("blob " + data.length + "\0")
              .update(data)
              .digest("hex") !== blob
          )
            continue;
          await mkdir(dirname(target), { recursive: true });
          await writeFile(target, data);
          valid = true;
          break;
        } catch {}
      }
      if (!valid) throw new Error("ORT source download or integrity check failed");
    }
  };
  await Promise.all(Array.from({ length: 8 }, () => worker()));
};
