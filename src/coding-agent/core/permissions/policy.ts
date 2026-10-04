import { realpathSync } from "node:fs";
import { resolve } from "node:path";

import { getAgentDir } from "../../config";
import { canonicalPath, isWithin } from "./paths";
import { PermissionError } from "./permission-error";
import { DEFAULT_PERMISSION_PRESET, isPermissionPreset } from "./types";
import type { ExecutionPolicy, PermissionPreset, ToolPermissionOptions } from "./types";

export class PermissionPolicy {
  readonly workspaceRoot: string;
  private readonly protectedPaths: string[];
  private readonly initial: PermissionPreset;

  constructor(
    cwd: string,
    options: ToolPermissionOptions = {},
    private readonly current?: () => PermissionPreset,
  ) {
    this.workspaceRoot = realpathSync(cwd);
    this.initial = options.permissionPreset ?? DEFAULT_PERMISSION_PRESET;
    this.protectedPaths = [
      ...new Set([getAgentDir(), ...(options.protectedPaths ?? [])].map((path) => resolve(path))),
    ];
    this.preset();
  }

  preset(): PermissionPreset {
    const value = this.current ? this.current() : this.initial;
    if (!isPermissionPreset(value)) throw new Error("Invalid permission preset");
    return value;
  }

  async resolve(tempRoot?: string): Promise<ExecutionPolicy> {
    const preset = this.preset();
    if ((await canonicalPath(this.workspaceRoot)) !== this.workspaceRoot) {
      throw new PermissionError("Workspace identity changed");
    }
    const protectedRoots = [
      ...new Set([
        ...this.protectedPaths,
        ...(await Promise.all(this.protectedPaths.map((path) => canonicalPath(path)))),
      ]),
    ];
    const writableRoots = preset === "workspace-write" ? [this.workspaceRoot] : [];
    if (tempRoot && preset === "workspace-write") {
      const temporary = await canonicalPath(tempRoot);
      if (protectedRoots.some((root) => isWithin(temporary, root) || isWithin(root, temporary))) {
        throw new PermissionError("Temporary directory overlaps protected storage");
      }
      writableRoots.push(temporary);
    }
    return { preset, workspaceRoot: this.workspaceRoot, writableRoots, protectedRoots };
  }

  async checkWrite(path: string): Promise<string> {
    const policy = await this.resolve();
    const target = await canonicalPath(path);
    if (policy.preset === "danger-full-access") return target;
    if (policy.preset === "read-only") throw new PermissionError("Files are read-only");
    if (!isWithin(target, policy.workspaceRoot))
      throw new PermissionError("Target is outside the workspace");
    if (policy.protectedRoots.some((root) => isWithin(target, root) || isWithin(root, target))) {
      throw new PermissionError("Target overlaps protected Loop storage");
    }
    return target;
  }
}

/** Unadvertised arguments must not be a way to grant or silently ignore a requested escalation. */
export const rejectEscalation = (args: Record<string, unknown>): void => {
  if (Object.hasOwn(args, "sandbox_permissions") || Object.hasOwn(args, "justification")) {
    throw new PermissionError("Sandbox escalation is not supported");
  }
};
