import type { VoicePlatform } from "../resources/resource-types";
import type { NativeDependencyRelease } from "./native-build-types";

export const nativeReleases: Record<VoicePlatform, NativeDependencyRelease> = {
  "darwin-arm64": {
    asset: "sherpa-onnx-v2.0.0-osx-arm64-shared.tar.bz2",
    sha256: "ca352a87d313fb1cce311c7b5ddc2e48df3ff899fb2c43ce8076071f029d1d3f",
  },
  "darwin-x64": {
    asset: "sherpa-onnx-v2.0.0-osx-x64-shared.tar.bz2",
    sha256: "6d67041ee4e8a683dd8f0789ba83d1bbb4ba6ab64c129f483fb77ff8b4a74e28",
  },
  "linux-x64": {
    asset: "sherpa-onnx-v2.0.0-linux-x64-shared.tar.bz2",
    sha256: "ee729caa387ede28fb62dd0c111e267da5ed436c9438ee502da9ee0a2e03ab7c",
  },
  "linux-arm64": {
    asset: "sherpa-onnx-v2.0.0-linux-aarch64-shared-cpu.tar.bz2",
    sha256: "0ee6e6a6de388f9db6f24c241ee6631c7509d47f3c8e5cd7b05259ff92f722b6",
  },
  "win32-x64": {
    asset: "sherpa-onnx-v2.0.0-win-x64-shared-MT-Release.tar.bz2",
    sha256: "a66a89c6f3401f3f26a6f53d39ea632900884cbd6a116155e2a85f434b6a7bda",
  },
};
