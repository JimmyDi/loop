import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { extract } from "tar-stream";

import { matchesResource } from "./download";
import { safeResourcePath } from "./resource-paths";
import type { VoiceComponent } from "./resource-types";

export const extractComponent = async (
  archive: string,
  destination: string,
  component: VoiceComponent,
  signal?: AbortSignal,
): Promise<void> => {
  signal?.throwIfAborted();
  const expected = new Map(component.files.map((file) => [file.path, file]));
  const found = new Set<string>();
  const unpack = extract();
  let failure: Error | undefined;
  unpack.on("entry", (header, stream, next) => {
    stream.on("error", () => {});
    const action = async () => {
      signal?.throwIfAborted();
      const path = header.name;
      if (!safeResourcePath(path) || header.type !== "file" || found.has(path))
        throw new Error("voice_archive_entry_invalid");
      const file = expected.get(path);
      if (!file || header.size !== file.bytes) throw new Error("voice_archive_entry_invalid");
      found.add(path);
      const target = join(destination, path);
      await mkdir(dirname(target), { recursive: true, mode: 0o700 });
      await pipeline(
        stream,
        createWriteStream(target, { flags: "wx", mode: file.executable ? 0o700 : 0o600 }),
      );
      if (!(await matchesResource(target, file)))
        throw new Error("voice_resource_integrity_failed");
    };
    void action().then(
      () => next(),
      (error) => {
        failure = error;
        stream.destroy(error);
        unpack.destroy(error);
      },
    );
  });
  await pipeline(createReadStream(archive), createGunzip(), unpack, { signal });
  signal?.throwIfAborted();
  if (failure) throw failure;
  if (found.size !== expected.size) throw new Error("voice_archive_incomplete");
};
