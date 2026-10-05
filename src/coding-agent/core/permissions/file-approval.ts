import { lstat, readFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { ToolApprovalContext } from "../approvals/tool-approvals";
import { PermissionError } from "./permission-error";
import type { PermissionPolicy } from "./policy";
import { canonicalPath, existingAncestor, isWithin } from "./paths";

export type FileSnapshot = {
  bytes: Uint8Array | null;
  sha256: string | null;
  identity: string | null;
};

export type FileWritePermit = {
  target: string;
  check: () => Promise<void>;
  consume: (path: string, content: string) => Promise<void>;
};

const digest = (value: string | Uint8Array): string =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");

export const snapshotFile = async (path: string): Promise<FileSnapshot> => {
  try {
    const info = await lstat(path);
    if (!info.isFile()) throw new PermissionError("Target is not a regular file");
    const bytes = await readFile(path);
    return {
      bytes,
      sha256: digest(bytes),
      identity: [info.dev, info.ino, info.mode, info.size, info.mtimeMs, info.ctimeMs].join(":"),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return { bytes: null, sha256: null, identity: null };
  }
};

/** The permit is held in the executing call's closure, never accepted from tool arguments. */
export const approveFileWrite = async (
  policy: PermissionPolicy,
  path: string,
  target: string,
  content: string,
  before: FileSnapshot,
  signal: AbortSignal,
  approval?: ToolApprovalContext,
): Promise<FileWritePermit | undefined> => {
  const inspected = await policy.inspectWrite(path);
  if (inspected.target !== target) throw new PermissionError("Target changed before approval");
  if (!inspected.denial) return undefined;
  if (!approval) throw new PermissionError(inspected.denial + "; approval is unavailable");
  const preset = inspected.policy.preset;
  const parent = await existingAncestor(dirname(target));
  const parentInfo = await lstat(parent);
  const afterSha256 = digest(content);
  const result = await approval.request(
    {
      kind: "file-write",
      permissionMode: isWithin(target, inspected.policy.workspaceRoot)
        ? "workspace-write"
        : "danger-full-access",
      arguments: structuredClone(approval.arguments),
      workspaceRoot: policy.workspaceRoot,
      targetPath: target,
      beforeSha256: before.sha256,
      afterSha256,
    },
    typeof approval.arguments.justification === "string" && approval.arguments.justification.trim()
      ? approval.arguments.justification.trim()
      : inspected.denial,
  );
  signal.throwIfAborted();
  if (result.outcome !== "allowed-once")
    throw new PermissionError(inspected.denial + "; approval " + result.outcome);

  const check = async () => {
    signal.throwIfAborted();
    const current = await policy.inspectWrite(path);
    if (current.target !== target || current.policy.preset !== preset)
      throw new PermissionError("Approved target or policy changed");
    const nextParent = await lstat(parent);
    if (
      (await canonicalPath(parent)) !== parent ||
      nextParent.dev !== parentInfo.dev ||
      nextParent.ino !== parentInfo.ino
    )
      throw new PermissionError("Approved parent directory changed");
    const next = await snapshotFile(target);
    if (next.sha256 !== before.sha256 || next.identity !== before.identity)
      throw new PermissionError("File changed while awaiting approval");
  };
  let consumed = false;
  return {
    target,
    check,
    consume: async (requestedPath, requestedContent) => {
      if (consumed || requestedPath !== path || digest(requestedContent) !== afterSha256)
        throw new PermissionError("Approval does not match this write");
      consumed = true;
      await check();
    },
  };
};
