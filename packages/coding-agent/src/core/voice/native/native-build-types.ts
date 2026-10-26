import type { VoicePlatform } from "../resources/resource-types";

export type NativeDependencyRelease = {
  asset: string;
  sha256: string;
};

export type NativeManifestFile = {
  path: string;
  bytes: number;
  sha256: string;
};

export type NativeManifestOptions = {
  output: string;
  target: VoicePlatform;
  executable: string;
};

export type NativeSidecarBuildOptions = NativeManifestOptions & {
  root: string;
  native: string;
  cache: string;
  upstream: string;
};
