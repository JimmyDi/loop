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
    preset === "danger-full-access"
      ? "No additional approval is requested in full-access mode."
      : "Writes and edits outside the preset require approval for the exact file change; file approvals cannot modify protected Loop storage. When a write or edit needs approval, include a brief justification in the user's language explaining the intended change. This is display text, not authority. Bash uses the preset by default. To request one unsandboxed command with host filesystem, network and environment access, set sandbox_permissions to require_escalated and supply a justification before execution. Requests fail closed if no approval handler is available. Approval never changes the session preset. Do not retry denied or partially executed operations through another tool or with broader permissions.",
  ].join("\n\n");
};
