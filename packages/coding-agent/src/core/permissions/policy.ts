import { resolve } from "node:path";
import { realpathSync } from "node:fs";

import { getAgentDir } from "../../config";
import { canonicalPath, isWithin } from "./paths";
import { PermissionError } from "./permission-error";
import { DEFAULT_PERMISSION_PRESET, isPermissionPreset } from "./types";
import type { ExecutionPolicy, PermissionPreset, ToolPermissionOptions } from "./types";

export type PermissionObservation =
  | { type: "permission.policy.resolved"; preset: PermissionPreset; writableRootCount: number }
  | {
      type: "permission.write.checked";
      preset: PermissionPreset;
      targetPath: string;
      denial?: string;
    };

export class PermissionPolicy {
  readonly workspaceRoot: string;
  private readonly protectedPaths: string[];
  private readonly initial: PermissionPreset;
  private observers = new Set<(event: PermissionObservation) => void>();

  subscribe(listener: (event: PermissionObservation) => void): () => void {
    this.observers.add(listener);
    return () => {
      this.observers.delete(listener);
    };
  }

  private notify(event: PermissionObservation): void {
    for (const listener of this.observers) {
      try {
        listener({ ...event });
      } catch {
        /* Observation never grants permissions. */
      }
    }
  }

  constructor(
    cwd: string,
    options: ToolPermissionOptions = {},
    private readonly current?: () => PermissionPreset,
  ) {
    // Match fs.promises.realpath, including Windows short-name expansion and path casing.
    this.workspaceRoot = realpathSync.native(cwd);
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
    this.notify({
      type: "permission.policy.resolved",
      preset,
      writableRootCount: writableRoots.length,
    });
    return { preset, workspaceRoot: this.workspaceRoot, writableRoots, protectedRoots };
  }

  async inspectWrite(
    path: string,
  ): Promise<{ policy: ExecutionPolicy; target: string; denial?: string }> {
    const policy = await this.resolve();
    const target = await canonicalPath(path);
    if (policy.preset === "danger-full-access") {
      this.notify({ type: "permission.write.checked", preset: policy.preset, targetPath: target });
      return { policy, target };
    }
    if (policy.protectedRoots.some((root) => isWithin(target, root) || isWithin(root, target))) {
      this.notify({
        type: "permission.write.checked",
        preset: policy.preset,
        targetPath: target,
        denial: "Target overlaps protected Loop storage",
      });
      throw new PermissionError("Target overlaps protected Loop storage");
    }
    const denial =
      policy.preset === "read-only"
        ? "Files are read-only"
        : !isWithin(target, policy.workspaceRoot)
          ? "Target is outside the workspace"
          : undefined;
    this.notify({
      type: "permission.write.checked",
      preset: policy.preset,
      targetPath: target,
      denial,
    });
    return { policy, target, denial };
  }

  async checkWrite(path: string): Promise<string> {
    const inspected = await this.inspectWrite(path);
    if (inspected.denial) throw new PermissionError(inspected.denial);
    return inspected.target;
  }
}

/** File justifications are display text; shell escalation arguments never grant file authority. */
export const validateFilePermissionArguments = (args: Record<string, unknown>): void => {
  if (Object.hasOwn(args, "sandbox_permissions")) {
    throw new PermissionError("Sandbox escalation is not supported");
  }
  if (
    args.justification !== undefined &&
    (typeof args.justification !== "string" ||
      !args.justification.trim() ||
      args.justification.length > 240)
  ) {
    throw new PermissionError("Justification must be a nonempty string of at most 240 characters");
  }
};
