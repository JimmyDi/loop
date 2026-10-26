import { selectReleaseTargets } from "./release-targets";
import type { VoicePlatform } from "../resources/resource-types";
import type { VoiceWorkflowMatrix } from "./workflow-matrix-types";

const runners: Record<VoicePlatform, string> = {
  "darwin-arm64": "macos-15",
  "darwin-x64": "macos-15-intel",
  "linux-arm64": "ubuntu-22.04-arm",
  "linux-x64": "ubuntu-22.04",
  "win32-x64": "windows-2022",
};

export const voiceWorkflowMatrix = (value?: string): VoiceWorkflowMatrix => {
  const targets = selectReleaseTargets(value === undefined ? [] : ["--targets", value]);
  return {
    targets: targets.join(","),
    matrix: { include: targets.map((target) => ({ target, os: runners[target] })) },
  };
};
