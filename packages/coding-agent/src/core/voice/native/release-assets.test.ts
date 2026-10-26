import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { pack } from "tar-stream";
import { afterEach, expect, test } from "vitest";
import { reviewedReleaseComponent } from "./release-assets";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
const fixture = async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-voice-catalog-"));
  directories.push(directory);
  const data = Buffer.from("synthetic executable");
  const tar = pack();
  const chunks: Buffer[] = [];
  tar.on("data", (chunk) => chunks.push(chunk as Buffer));
  const ended = new Promise<void>((yes, no) => {
    tar.once("end", yes);
    tar.once("error", no);
  });
  tar.entry({ name: "loop-voice" }, data);
  tar.finalize();
  await ended;
  const bytes = gzipSync(Buffer.concat(chunks));
  const item = {
    id: "loop-voice-linux-x64",
    kind: "engine",
    version: "1.0.0",
    files: [
      {
        path: "loop-voice",
        bytes: data.length,
        sha256: createHash("sha256").update(data).digest("hex"),
        executable: true,
        url: "https://example.test/injected",
      },
    ],
    archive: {
      filename: "loop-voice-linux-x64.tar.gz",
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      expandedBytes: data.length,
    },
  };
  await writeFile(join(directory, item.archive.filename), bytes);
  return { directory, item };
};

test("verifies archive contents and emits only the Loop release URL", async () => {
  const { directory, item } = await fixture();
  const component = await reviewedReleaseComponent(directory, "voice-v1.0.0", item);
  expect(component.archive?.url).toBe(
    "https://github.com/JimmyDi/loop/releases/download/voice-v1.0.0/loop-voice-linux-x64.tar.gz",
  );
  expect(component.files[0]?.url).toBe("");
});

test("rejects tampered expanded file metadata even when the archive digest is correct", async () => {
  const { directory, item } = await fixture();
  item.files[0]!.sha256 = "0".repeat(64);
  await expect(reviewedReleaseComponent(directory, "voice-v1.0.0", item)).rejects.toThrow(
    "voice_resource_integrity_failed",
  );
});

test("rejects traversal and non-pinned model metadata", async () => {
  const { directory, item } = await fixture();
  await expect(
    reviewedReleaseComponent(directory, "voice-v1.0.0", {
      ...item,
      archive: { ...item.archive, filename: "../outside.tar.gz" },
    }),
  ).rejects.toThrow("Invalid voice asset metadata");
  await expect(
    reviewedReleaseComponent(directory, "voice-v1.0.0", { ...item, kind: "asr" }),
  ).rejects.toThrow("pinned source catalog");
});
