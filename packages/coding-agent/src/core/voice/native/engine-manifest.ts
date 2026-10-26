import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { NativeManifestFile, NativeManifestOptions } from "./native-build-types";

export const writeEngineManifest = async (options: NativeManifestOptions): Promise<void> => {
  const { output, target, executable } = options;
  const files: NativeManifestFile[] = [];
  const visit = async (directory: string, prefix = "") => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = prefix + entry.name;
      if (entry.isDirectory()) await visit(join(directory, entry.name), path + "/");
      else if (!/\.(obj|lib|exp|pdb)$/.test(path) && path !== "engine-manifest.json") {
        const bytes = await readFile(join(directory, entry.name));
        files.push({
          path,
          bytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        });
      }
    }
  };
  await visit(output);
  await writeFile(
    join(output, "engine-manifest.json"),
    JSON.stringify(
      {
        version: 1,
        protocolVersion: 1,
        engineVersion: "1.0.0",
        sherpaVersion: "2.0.0",
        platform: target,
        executable,
        files,
      },
      null,
      2,
    ) + "\n",
  );
};
