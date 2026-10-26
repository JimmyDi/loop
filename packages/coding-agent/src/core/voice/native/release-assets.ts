import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractComponent } from "../resources/archive";
import {
  sourceVoiceModels,
  VOICE_ENGINE_LICENSE,
  VOICE_ENGINE_VERSION,
} from "../resources/catalog";
import { hashFile } from "../resources/download";
import type { VoiceComponent, VoicePlatform } from "../resources/resource-types";
import { componentHash, safeResourcePath } from "../resources/resource-paths";
import { assertReleaseFilesClean } from "./release-scan";
import type { ReviewedVoiceComponent } from "./release-assets-types";

export const releaseVoicePlatforms: readonly VoicePlatform[] = [
  "darwin-arm64",
  "darwin-x64",
  "linux-arm64",
  "linux-x64",
  "win32-x64",
];

export const reviewedReleaseComponent = async (
  directory: string,
  tag: string,
  input: unknown,
): Promise<VoiceComponent> => {
  if (!/^voice-v[0-9]+[.][0-9]+[.][0-9]+$/.test(tag)) throw new Error("Invalid voice release tag");
  if (!input || typeof input !== "object") throw new Error("Invalid voice asset metadata");
  const item = input as ReviewedVoiceComponent;
  const archive = item.archive;
  if (
    !archive ||
    typeof item.id !== "string" ||
    !/^[a-zA-Z0-9_-]+$/.test(item.id) ||
    archive.filename !== item.id + ".tar.gz" ||
    !Number.isSafeInteger(archive.bytes) ||
    archive.bytes <= 0 ||
    archive.bytes > 512 * 1024 * 1024 ||
    !/^[a-f0-9]{64}$/.test(archive.sha256) ||
    !Array.isArray(item.files) ||
    !item.files.length ||
    item.files.length > 64 ||
    item.files.some(
      (file) =>
        !file ||
        !safeResourcePath(file.path) ||
        !Number.isSafeInteger(file.bytes) ||
        file.bytes <= 0 ||
        file.bytes > 512 * 1024 * 1024 ||
        !/^[a-f0-9]{64}$/.test(file.sha256),
    ) ||
    new Set(item.files.map((file) => file.path)).size !== item.files.length ||
    archive.expandedBytes !== item.files.reduce((sum, file) => sum + file.bytes, 0)
  )
    throw new Error("Invalid voice asset metadata");
  let component: VoiceComponent;
  if (item.kind === "engine") {
    const platform = releaseVoicePlatforms.find((value) => item.id === "loop-voice-" + value);
    const executable = platform === "win32-x64" ? "loop-voice.exe" : "loop-voice";
    if (
      !platform ||
      item.version !== VOICE_ENGINE_VERSION ||
      !item.files.some((file) => file.path === executable && file.executable === true) ||
      item.files.some((file) => file.executable === true && file.path !== executable)
    )
      throw new Error("Invalid native engine asset");
    component = {
      id: item.id,
      name: "Loop local voice engine",
      kind: "engine",
      version: VOICE_ENGINE_VERSION,
      license: VOICE_ENGINE_LICENSE,
      files: item.files.map(({ path, sha256, bytes, executable }) => ({
        path,
        sha256,
        bytes,
        url: "",
        ...(executable ? { executable: true } : {}),
      })),
    };
  } else {
    const source = sourceVoiceModels.find((value) => value.id === item.id);
    if (
      !source ||
      item.kind !== source.kind ||
      item.version !== source.version ||
      componentHash({ ...item, archive: undefined }) !== componentHash(source)
    )
      throw new Error("Voice model differs from pinned source catalog");
    component = { ...source, files: source.files.map((file) => ({ ...file, url: "" })) };
  }
  const path = join(directory, archive.filename);
  if ((await stat(path)).size !== archive.bytes || (await hashFile(path)) !== archive.sha256)
    throw new Error("Voice release archive integrity mismatch");
  const temporary = await mkdtemp(join(tmpdir(), "loop-voice-release-"));
  try {
    await extractComponent(path, temporary, component);
    await assertReleaseFilesClean(temporary, component);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
  return {
    ...component,
    archive: {
      url: "https://github.com/JimmyDi/loop/releases/download/" + tag + "/" + archive.filename,
      bytes: archive.bytes,
      expandedBytes: archive.expandedBytes,
      sha256: archive.sha256,
    },
  };
};

export const readReviewedMetadata = async (path: string): Promise<unknown[]> => {
  const value: unknown = JSON.parse(await readFile(path, "utf8"));
  return Array.isArray(value) ? value : [value];
};
