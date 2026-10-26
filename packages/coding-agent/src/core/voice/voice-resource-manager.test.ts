import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { pack } from "tar-stream";
import { afterEach, expect, test, vi } from "vitest";

import type { VoiceActivation } from "./resources/activation-types";
import { publishedVoiceEngines, sourceVoiceModels, voicePlatform } from "./resources/catalog";
import { engineComponent } from "./resources/engine-manifest";
import { atomicJson } from "./resources/json-storage";
import { componentDirectory } from "./resources/resource-paths";
import type { VoiceComponent, VoiceEngineManifest } from "./resources/resource-types";
import { VoiceResourceManager } from "./voice-resource-manager";

const directories: string[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  delete publishedVoiceEngines[voicePlatform()!];
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

const activate = async (
  manager: VoiceResourceManager,
  manifest: VoiceEngineManifest,
): Promise<VoiceActivation> => {
  const bytes = Buffer.from("synthetic model");
  const models = sourceVoiceModels
    .filter((item) => item.kind !== "tts")
    .map((item) => ({
      ...item,
      files: item.files.map((file) => ({
        ...file,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      })),
    }));
  for (const model of models) {
    const directory = componentDirectory(manager.directory, model);
    await mkdir(directory, { recursive: true });
    for (const file of model.files) await writeFile(join(directory, file.path), bytes);
  }
  const active: VoiceActivation = {
    version: 1,
    catalog: "previous-catalog",
    engine: { component: engineComponent(manifest), executable: manifest.executable },
    models,
    tts: false,
  };
  await atomicJson(join(manager.directory, "active.json"), active);
  return active;
};
const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "loop-voice-resources-"));
  directories.push(root);
  const source = join(root, "build");
  await mkdir(source);
  const bytes = Buffer.from("synthetic native engine");
  const executable = process.platform === "win32" ? "loop-voice.exe" : "loop-voice";
  await writeFile(join(source, executable), bytes);
  const manifest: VoiceEngineManifest = {
    version: 1,
    protocolVersion: 1,
    engineVersion: "1.0.0",
    sherpaVersion: "2.0.0",
    platform: voicePlatform()!,
    executable,
    files: [
      {
        path: executable,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
    ],
  };
  return { root, source, manifest, manager: new VoiceResourceManager(join(root, "data")) };
};

test("reports unpublished engine assets honestly without attempting a download", async () => {
  const { manager } = await fixture();
  expect(await manager.status()).toMatchObject({ engineAvailable: false, installed: false });
  await expect(manager.install()).rejects.toThrow("voice_engine_unavailable");
  expect(await manager.status()).toMatchObject({
    phase: "error",
    error: "voice_engine_unavailable",
  });
});

test("reports required installation size separately from currently installed bytes", async () => {
  const { manager, source, manifest } = await fixture();
  const status = await manager.status();
  expect(status.components[0]).toMatchObject({ requiredBytes: 0, installedBytes: 0 });
  for (const model of sourceVoiceModels) {
    const component = status.components.find((item) => item.id === model.id);
    expect(component).toMatchObject({
      requiredBytes: model.files.reduce((sum, file) => sum + file.bytes, 0),
      installedBytes: 0,
      installed: false,
    });
    expect(component!.requiredBytes).toBeGreaterThan(0);
  }
  await manager.importLocalEngine(source, manifest);
  const requiredBytes = manifest.files.reduce((sum, file) => sum + file.bytes, 0);
  expect((await manager.status()).components[0]).toMatchObject({
    requiredBytes,
    installedBytes: requiredBytes,
    installed: true,
  });
});

test("imports verified local binaries and does not allow concurrent resource mutations", async () => {
  const { source, manifest, manager } = await fixture();
  const importing = manager.importLocalEngine(source, manifest);
  await expect(manager.uninstall()).rejects.toThrow("voice_resources_busy");
  await importing;
  expect((await manager.status()).components[0]).toMatchObject({ installed: true });
  await expect(manager.install()).rejects.toThrow("voice_resource_asset_unavailable");
  await manager.uninstall();
  expect(await manager.status()).toMatchObject({ installed: false, engineAvailable: false });
});

test("rejects incompatible or traversing manifests before copying local files", async () => {
  const { source, manifest, manager } = await fixture();
  await expect(
    manager.importLocalEngine(source, { ...manifest, protocolVersion: 2 as 1 }),
  ).rejects.toThrow("manifest_invalid");
  await expect(
    manager.importLocalEngine(source, { ...manifest, executable: "../escape" }),
  ).rejects.toThrow("manifest_invalid");
});

test("rejects modified local engines and unexpected extra libraries", async () => {
  const { source, manifest, manager } = await fixture();
  await writeFile(join(source, manifest.executable), "corrupt");
  await expect(manager.importLocalEngine(source, manifest)).rejects.toThrow("integrity");
  await writeFile(join(source, manifest.executable), "synthetic native engine");
  await writeFile(join(source, "unexpected.dll"), "extra");
  await expect(manager.importLocalEngine(source, manifest)).rejects.toThrow("files_invalid");
});

test("repairs an imported component with the same content-addressed destination", async () => {
  const { source, manifest, manager } = await fixture();
  await manager.importLocalEngine(source, manifest);
  const executable = join(
    componentDirectory(manager.directory, engineComponent(manifest)),
    manifest.executable,
  );
  await writeFile(executable, Buffer.alloc(manifest.files[0]!.bytes));
  await manager.importLocalEngine(source, manifest);
  expect(await readFile(executable, "utf8")).toBe("synthetic native engine");
});

test("requires an activation and preserves a previous compatible activation after failed updates", async () => {
  const { source, manifest, manager } = await fixture();
  await manager.importLocalEngine(source, manifest);
  expect(await manager.status()).toMatchObject({ installed: false });
  const active = await activate(manager, manifest);
  expect(await manager.status()).toMatchObject({ installed: true, updateAvailable: true });
  await expect(manager.update()).rejects.toThrow("voice_resource_asset_unavailable");
  expect(JSON.parse(await readFile(join(manager.directory, "active.json"), "utf8"))).toEqual(
    active,
  );
  const lease = await manager.acquireRuntime();
  expect(lease.resources.executablePath).toContain(manifest.executable);
  lease.release();
});

test("holds an exclusive resource lease with idempotent release and verifies full digests", async () => {
  const { source, manifest, manager } = await fixture();
  await manager.importLocalEngine(source, manifest);
  await activate(manager, manifest);
  const acquiring = manager.acquireRuntime();
  await expect(manager.acquireRuntime()).rejects.toThrow("voice_resources_busy");
  await expect(manager.uninstall()).rejects.toThrow("voice_resources_busy");
  const lease = await acquiring;
  const other = new VoiceResourceManager(join(manager.directory, ".."));
  await expect(other.uninstall()).rejects.toThrow("voice_resources_busy");
  await expect(other.acquireRuntime()).rejects.toThrow("voice_resources_busy");
  await expect(manager.importLocalEngine(source, manifest)).rejects.toThrow("voice_resources_busy");
  lease.release();
  lease.release();
  await writeFile(lease.resources.executablePath, Buffer.alloc(manifest.files[0]!.bytes));
  await expect(manager.acquireRuntime()).rejects.toThrow("voice_resource_integrity_failed");
  await manager.uninstall();
});

test("recovers malformed activation metadata and allows uninstall", async () => {
  const { manager, source, manifest } = await fixture();
  await manager.importLocalEngine(source, manifest);
  await writeFile(join(manager.directory, "active.json"), "{");
  expect(await manager.status()).toMatchObject({ installed: false, ttsInstalled: false });
  await writeFile(
    join(manager.directory, "active.json"),
    JSON.stringify({ version: 1, engine: { component: { files: [null] } } }),
  );
  expect(await manager.status()).toMatchObject({ installed: false });
  await manager.uninstall();
});

test("cancelled installation keeps the previous activation available", async () => {
  const { manager, source, manifest } = await fixture();
  await manager.importLocalEngine(source, manifest);
  await activate(manager, manifest);
  const controller = new AbortController();
  controller.abort();
  await expect(manager.install({}, controller.signal)).rejects.toThrow(
    "voice_resource_operation_failed",
  );
  const lease = await manager.acquireRuntime();
  lease.release();
});

test("installs a published engine archive even though individual file URLs are empty", async () => {
  const { source, manifest, manager } = await fixture();
  const tar = pack();
  const chunks: Buffer[] = [];
  tar.on("data", (chunk) => chunks.push(chunk as Buffer));
  const ended = new Promise<void>((yes, no) => {
    tar.once("end", yes);
    tar.once("error", no);
  });
  tar.entry({ name: manifest.executable }, await readFile(join(source, manifest.executable)));
  tar.finalize();
  await ended;
  const bytes = gzipSync(Buffer.concat(chunks));
  const component: VoiceComponent = {
    ...engineComponent(manifest),
    archive: {
      url: "https://github.com/loop-test/voice/releases/download/v1/engine.tar.gz",
      bytes: bytes.length,
      expandedBytes: manifest.files[0]!.bytes,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    },
  };
  publishedVoiceEngines[manifest.platform] = component;
  expect((await manager.status()).components[0]).toMatchObject({
    downloadBytes: bytes.length,
    requiredBytes: manifest.files[0]!.bytes,
    installedBytes: 0,
  });
  const fetcher = vi.fn(async () => new Response(bytes));
  vi.stubGlobal("fetch", fetcher);
  await expect(manager.install()).rejects.toThrow("voice_resource_asset_unavailable");
  expect(fetcher).toHaveBeenCalledOnce();
  expect((await manager.status()).components[0]).toMatchObject({ installed: true });
});
