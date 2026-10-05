import type { ToolApprovalContext } from "../approvals/tool-approvals";
import { PermissionError } from "./permission-error";
import type { PermissionPolicy } from "./policy";

/** Decide before dispatch; a failed shell command is never rerun with more authority. */
export const approveShell = async (
  policy: PermissionPolicy,
  args: Record<string, unknown>,
  signal: AbortSignal,
  approval?: ToolApprovalContext,
): Promise<boolean> => {
  const mode = args.sandbox_permissions ?? "use_default";
  if (mode !== "use_default" && mode !== "require_escalated")
    throw new PermissionError("Invalid sandbox permission request");
  if (mode === "use_default") {
    if (args.justification !== undefined)
      throw new PermissionError("Justification requires an escalation request");
    return false;
  }
  if (typeof args.justification !== "string" || !args.justification.trim())
    throw new PermissionError("An escalation request requires a justification");
  signal.throwIfAborted();
  const current = await policy.resolve();
  if (current.preset === "danger-full-access") return false;
  if (!approval) throw new PermissionError("Shell escalation requires a managed approval handler");
  const result = await approval.request(
    {
      kind: "shell-unrestricted",
      arguments: structuredClone(approval.arguments),
      workspaceRoot: current.workspaceRoot,
      filesystem: "host",
      network: "host",
      environment: "host",
    },
    args.justification,
  );
  signal.throwIfAborted();
  if (result.outcome !== "allowed-once")
    throw new PermissionError("Shell escalation approval " + result.outcome);
  if ((await policy.resolve()).preset !== current.preset)
    throw new PermissionError("Policy changed while awaiting approval");
  return true;
};
