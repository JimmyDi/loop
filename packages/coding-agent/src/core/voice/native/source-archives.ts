import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, rename, rm } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { extract } from "tar-stream";
import { hashFile } from "../resources/download";
import { sourceCommand } from "./source-command";

export const verifiedSourceArchive = async (
  cache: string,
  name: string,
  url: string,
  sha256: string,
): Promise<string> => {
  await mkdir(cache, { recursive: true });
  const archive = join(cache, name);
  try {
    if ((await hashFile(archive)) === sha256) return archive;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(600_000) });
  if (!response.ok || !response.body) throw new Error("Voice source archive download failed");
  const temporary = archive + ".partial";
  await pipeline(
    Readable.fromWeb(response.body as NodeReadableStream),
    createWriteStream(temporary, { flags: "w", mode: 0o600 }),
  );
  if ((await hashFile(temporary)) !== sha256)
    throw new Error("Voice source archive integrity mismatch");
  await rename(temporary, archive);
  return archive;
};

export const unpackSourceArchive = async (
  archive: string,
  destination: string,
): Promise<string> => {
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  if (archive.endsWith(".zip")) {
    await sourceCommand("unzip", ["-q", archive, "-d", destination]);
  } else {
    const unpack = extract();
    unpack.on("entry", (header, stream, next) => {
      stream.on("error", () => {});
      const action = async () => {
        const target = resolve(destination, header.name);
        if (!target.startsWith(resolve(destination) + sep) || header.name.includes("\\"))
          throw new Error("Voice source archive path rejected");
        if (header.type === "directory") await mkdir(target, { recursive: true });
        else if (header.type === "file") {
          await mkdir(dirname(target), { recursive: true });
          await pipeline(stream, createWriteStream(target, { flags: "wx", mode: 0o600 }));
        } else stream.resume();
      };
      void action().then(
        () => next(),
        (error) => unpack.destroy(error),
      );
    });
    await pipeline(createReadStream(archive), createGunzip(), unpack);
  }
  const entries = await readdir(destination, { withFileTypes: true });
  if (entries.length !== 1 || !entries[0]!.isDirectory())
    throw new Error("Voice source archive root invalid");
  return join(destination, entries[0]!.name);
};
