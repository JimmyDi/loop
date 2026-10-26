import type { VoiceComponent } from "../resources/resource-types";

export type ReviewedVoiceArchive = {
  filename: string;
  bytes: number;
  expandedBytes: number;
  sha256: string;
};

export type ReviewedVoiceComponent = Omit<VoiceComponent, "archive"> & {
  archive: ReviewedVoiceArchive;
};

export type VoiceReleaseScanInput = {
  files: readonly Pick<VoiceComponent["files"][number], "path">[];
};
