import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { pack } from "tar-stream";
import { validateEngineManifest, engineComponent } from "../resources/engine-manifest";
import { verifyLocalComponent } from "../resources/local-component-verification";
import { assertReleaseFilesClean } from "./release-scan";

const [engineArg, outputArg] = process.argv.slice(2);
if (!engineArg || !outputArg)
  throw new Error("Usage: prepare-engine.ts <engine-directory> <output-directory>");
const directory = resolve(engineArg),
  output = resolve(outputArg);
await mkdir(output, { recursive: true });
const manifest = validateEngineManifest(
  JSON.parse(await readFile(join(directory, "engine-manifest.json"), "utf8")),
);
const component = engineComponent(manifest);
await verifyLocalComponent(directory, component);
await assertReleaseFilesClean(directory, component);
const filename = component.id + ".tar.gz";
const tar = pack();
const writing = pipeline(tar, createGzip({ level: 9 }), createWriteStream(join(output, filename)));
for (const file of component.files) {
  await new Promise<void>((yes, no) => {
    const entry = tar.entry(
      {
        name: file.path,
        size: file.bytes,
        mode: file.executable ? 0o700 : 0o600,
        mtime: new Date(0),
        uid: 0,
        gid: 0,
      },
      (error) => (error ? no(error) : yes()),
    );
    void pipeline(createReadStream(join(directory, file.path)), entry).catch(no);
  });
}
tar.finalize();
await writing;
const bytes = await readFile(join(output, filename));
await writeFile(
  join(output, "reviewed-engine-" + manifest.platform + ".json"),
  JSON.stringify(
    {
      ...component,
      archive: {
        filename,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        bytes: bytes.length,
        expandedBytes: component.files.reduce((sum, file) => sum + file.bytes, 0),
      },
    },
    null,
    2,
  ) + "\n",
);
console.log("Prepared native release asset locally.");
