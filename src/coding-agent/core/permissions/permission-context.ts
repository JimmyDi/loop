import { approvalPolicyFor } from "./types";
import type { PermissionPreset } from "./types";

export const buildPermissionContext = (
  preset: PermissionPreset | undefined,
  workspaceRoot: string,
): string => {
  if (!preset) return "";

  const filePolicy: Record<PermissionPreset, string> = {
    "read-only": "File writes and edits are denied, except required shell sinks such as /dev/null.",
    "workspace-write":
      "File writes and edits are limited to the session workspace: " +
      JSON.stringify(workspaceRoot) +
      ". Bash may also write to its private temporary directory. Loop storage remains protected.",
    "danger-full-access":
      "Loop does not confine file writes or shell processes. Host user permissions still apply.",
  };

  return [
    "Loop runtime context (host-provided). This snapshot supersedes earlier runtime context.",
    "Current permission preset: " + preset + ".",
    filePolicy[preset],
    preset === "danger-full-access"
      ? "Loop does not restrict shell network access."
      : "Restricted shell commands have no network access. File reads are not confined to the workspace.",
    "Approval policy: " + approvalPolicyFor(preset) + ".",
    "Approval and escalation are unavailable; operations requiring additional authority are denied. Do not retry denied operations through another tool.",
  ].join("\n\n");
};
