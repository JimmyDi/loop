export type SourceDependency = {
  name: string;
  url: string;
  sha256: string;
};

export type VoiceSourceDependency = SourceDependency & {
  licenses: readonly string[];
};
