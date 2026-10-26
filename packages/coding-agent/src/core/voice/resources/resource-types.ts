import type { VoiceReleaseManifest } from "./release-manifest-types";

export type VoicePlatform =
  | "darwin-arm64"
  | "darwin-x64"
  | "linux-arm64"
  | "linux-x64"
  | "win32-x64";

export type VoiceResourceFile = {
  path: string;
  url: string;
  sha256: string;
  bytes: number;
  executable?: boolean;
};

export type VoiceArchive = {
  url: string;
  sha256: string;
  bytes: number;
  expandedBytes: number;
};

export type VoiceComponent = {
  id: string;
  name: string;
  kind: "engine" | "asr" | "vad" | "tts";
  version: string;
  license: string;
  files: readonly VoiceResourceFile[];
  archive?: VoiceArchive;
};

export type VoiceInstalledComponent = Omit<VoiceComponent, "files"> & {
  installed: boolean;
  downloadBytes: number;
  requiredBytes: number;
  installedBytes: number;
};

export type VoiceResourceStatus = {
  supported: boolean;
  installed: boolean;
  ttsInstalled: boolean;
  engineAvailable: boolean;
  directory: string;
  version: string;
  updateAvailable: boolean;
  phase: "idle" | "installing" | "updating" | "uninstalling" | "error";
  components: VoiceInstalledComponent[];
  download?: { componentId: string; received: number; total: number };
  error?: string;
};

export type VoiceEngineManifest = {
  version: 1;
  protocolVersion: 1;
  engineVersion: string;
  sherpaVersion: "2.0.0";
  platform: VoicePlatform;
  executable: string;
  files: Array<{ path: string; sha256: string; bytes: number }>;
};

export type VoiceEngineSelection = {
  component: VoiceComponent;
  executable: string;
};

export type VoiceResourceOperationState = {
  release?: VoiceReleaseManifest;
  releaseCheckedAt?: number;
  phase: VoiceResourceStatus["phase"];
  download?: VoiceResourceStatus["download"];
  error?: string;
};

export type VoiceResourceInstallOptions = {
  tts?: boolean;
};
