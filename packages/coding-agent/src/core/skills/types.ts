export type SkillScope = "personal" | "project";

export type SkillSource = {
  kind: "github" | "local" | "created" | "discovered";
  location?: string;
  ref?: string;
  revision?: string;
  subdirectory?: string;
};

export type SkillSummary = {
  id: string;
  handle: string;
  name: string;
  description: string;
  path: string;
  scope: SkillScope;
  enabled: boolean;
  modelInvocable: boolean;
  managed: boolean;
  source: SkillSource;
  error?: string;
};

export type LoadedSkill = {
  id: string;
  name: string;
  description?: string;
  path: string;
  content: string;
  revision: string;
};

export type SkillCatalog = {
  skills: SkillSummary[];
  discovering: boolean;
  error?: string;
};

export type SkillPreviewInput = {
  kind: "github" | "local" | "created";
  location?: string;
  ref?: string;
  content?: string;
};

export type SkillCandidate = {
  key: string;
  name: string;
  description: string;
  content: string;
  files: string[];
};

export type SkillJob = {
  id: string;
  status: "running" | "ready" | "error" | "cancelled";
  stage: "downloading" | "checking" | "installing";
  candidates?: SkillCandidate[];
  error?: string;
  source?: SkillSource;
};

export type SkillSettings = {
  version: 1;
  disabled: string[];
  installations: Record<string, SkillSource>;
};

export class SkillError extends Error {
  constructor(
    readonly code: string,
    message = code,
  ) {
    super(message);
    this.name = "SkillError";
  }
}
