import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import type { VoiceComponent } from "../resources/resource-types";
import { assertReleaseFilesClean } from "./release-scan";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
const fixture = async (bytes: Uint8Array) => {
  const directory = await mkdtemp(join(tmpdir(), "loop-voice-scan-"));
  directories.push(directory);
  await writeFile(join(directory, "engine.bin"), bytes);
  const component: VoiceComponent = {
    id: "synthetic",
    name: "synthetic",
    kind: "engine",
    version: "1",
    license: "MIT",
    files: [{ path: "engine.bin", bytes: bytes.length, sha256: "0".repeat(64), url: "" }],
  };
  return { directory, component };
};

test.each([
  Buffer.from("/" + "Users/" + "synthetic/source.cc"),
  Buffer.from("/" + "home/" + "synthetic/source.cc"),
  Buffer.from("C:\\Users\\" + "synthetic\\source.cc", "utf16le"),
  Buffer.from("/" + "Users/" + "synthetic/source.cc", "utf16le").swap16(),
  Buffer.concat([Buffer.alloc(65532), Buffer.from("/" + "Users/" + "synthetic/source.cc")]),
])("rejects embedded home paths without exposing the value", async (bytes) => {
  const { directory, component } = await fixture(bytes);
  await expect(assertReleaseFilesClean(directory, component)).rejects.toThrow(
    "voice_release_embedded_home_path",
  );
});

test("accepts repository-relative source references", async () => {
  const { directory, component } = await fixture(
    Buffer.from("upstream/onnxruntime/core/session.cc"),
  );
  await assertReleaseFilesClean(directory, component);
});
