import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { pack } from "tar-stream";
import { sourceVoiceModels } from "../resources/catalog";
import { prepareModelFiles } from "./prepare-model-files";
import type { ReviewedVoiceComponent } from "./release-assets-types";

const output = resolve(process.argv[2] ?? ".tools/voice/model-assets");
await mkdir(output, { recursive: true });
const prepared: ReviewedVoiceComponent[] = [];
for (const component of sourceVoiceModels) {
  const directory = join(output, "models", component.id);
  await mkdir(directory, { recursive: true });
  await prepareModelFiles(directory, component.files);
  const archive = join(output, component.id + ".tar.gz");
  const tar = pack();
  const writing = pipeline(tar, createGzip({ level: 9 }), createWriteStream(archive));
  for (const file of component.files) {
    await new Promise<void>((yes, no) => {
      const entry = tar.entry(
        { name: file.path, size: file.bytes, mode: 0o600, mtime: new Date(0), uid: 0, gid: 0 },
        (error) => (error ? no(error) : yes()),
      );
      void pipeline(createReadStream(join(directory, file.path)), entry).catch(no);
    });
  }
  tar.finalize();
  await writing;
  const bytes = await readFile(archive);
  prepared.push({
    ...component,
    files: component.files.map(({ url: _url, ...file }) => ({ ...file, url: "" })),
    archive: {
      filename: component.id + ".tar.gz",
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.length,
      expandedBytes: component.files.reduce((sum, file) => sum + file.bytes, 0),
    },
  });
}
await writeFile(
  join(output, "reviewed-model-assets.json"),
  JSON.stringify(prepared, null, 2) + "\n",
);
console.log("Prepared model assets locally. No files were uploaded or published.");
