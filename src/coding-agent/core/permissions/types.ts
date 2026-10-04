export type PermissionPreset = "read-only" | "workspace-write" | "danger-full-access";

export type ApprovalPolicy = "ask" | "never";

export type ToolPermissionOptions = {
  permissionPreset?: PermissionPreset;
  protectedPaths?: readonly string[];
};

export type ExecutionPolicy = {
  preset: PermissionPreset;
  workspaceRoot: string;
  writableRoots: string[];
  protectedRoots: string[];
};

export const DEFAULT_PERMISSION_PRESET: PermissionPreset = "read-only";

export const isPermissionPreset = (value: unknown): value is PermissionPreset =>
  value === "read-only" || value === "workspace-write" || value === "danger-full-access";

export const approvalPolicyFor = (preset: PermissionPreset): ApprovalPolicy =>
  preset === "danger-full-access" ? "never" : "ask";
