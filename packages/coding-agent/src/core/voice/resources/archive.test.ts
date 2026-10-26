import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { pack } from "tar-stream";
import { afterEach, expect, test } from "vitest";

import { extractComponent } from "./archive";
import type { VoiceComponent } from "./resource-types";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
const fixture = async (name = "model.onnx", type: "file" | "symlink" = "file") => {
  const root = await mkdtemp(join(tmpdir(), "loop-voice-archive-"));
  directories.push(root);
  const bytes = Buffer.from("synthetic model");
  const component: VoiceComponent = {
    id: "synthetic",
    name: "test",
    kind: "asr",
    version: "1",
    license: "MIT",
    files: [
      {
        path: "model.onnx",
        url: "",
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
    ],
  };
  const tar = pack();
  const chunks: Buffer[] = [];
  tar.on("data", (chunk) => chunks.push(chunk as Buffer));
  const finished = new Promise<void>((yes, no) => {
    tar.once("end", yes);
    tar.once("error", no);
  });
  tar.entry(
    { name, type, linkname: type === "symlink" ? "outside" : undefined },
    type === "file" ? bytes : Buffer.alloc(0),
  );
  tar.finalize();
  await finished;
  const archive = join(root, "bundle.tar.gz");
  await writeFile(archive, gzipSync(Buffer.concat(chunks)));
  const destination = join(root, "unpacked");
  await mkdir(destination);
  return { archive, destination, component, bytes };
};

test("extracts only declared regular files with exact digest and length", async () => {
  const f = await fixture();
  await extractComponent(f.archive, f.destination, f.component);
  expect(await readFile(join(f.destination, "model.onnx"))).toEqual(f.bytes);
});

test.each([
  ["../outside", "file"],
  ["model.onnx", "symlink"],
  ["unexpected.onnx", "file"],
] as const)("rejects archive entry %s %s", async (name, type) => {
  const f = await fixture(name, type);
  await expect(extractComponent(f.archive, f.destination, f.component)).rejects.toThrow(
    "entry_invalid",
  );
});
