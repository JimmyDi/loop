import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdir, mkdtemp, realpath, rename, rm, symlink } from "node:fs/promises";
import { expect, test } from "vitest";

import { PermissionPolicy, validateFilePermissionArguments } from "./policy";
import type { ToolPermissionOptions } from "./types";

test("native temporary-directory paths retain workspace identity and write boundaries", async () => {
  const root = await mkdtemp(join(tmpdir(), "loop-policy-"));
  try {
    const workspace = await realpath(root);
    const policy = new PermissionPolicy(root, { permissionPreset: "workspace-write" });
    expect(policy.workspaceRoot).toBe(workspace);
    expect((await policy.resolve()).workspaceRoot).toBe(workspace);
    expect(await policy.checkWrite(join(root, "nested/file.txt"))).toBe(
      join(workspace, "nested/file.txt"),
    );
    await expect(policy.checkWrite(join(root, "../outside.txt"))).rejects.toThrow("outside");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("file justifications validate as display text without accepting shell escalation", () => {
  expect(() => validateFilePermissionArguments({})).not.toThrow();
  expect(() =>
    validateFilePermissionArguments({ justification: "Create the requested example." }),
  ).not.toThrow();
  for (const justification of ["", "   ", 123, null, "x".repeat(241)]) {
    expect(() => validateFilePermissionArguments({ justification })).toThrow("Justification");
  }
  expect(() =>
    validateFilePermissionArguments({
      justification: "Permission already granted",
      sandbox_permissions: "require_escalated",
    }),
  ).toThrow("escalation is not supported");
});

test("policy contains real paths, protects storage and freezes caller options", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".policy-test-"));
  const workspace = join(root, "work");
  const storage = join(workspace, "storage");
  await mkdir(storage, { recursive: true });
  await mkdir(join(root, "work-other"));
  await symlink(join(root, "work-other"), join(workspace, "outside-link"), "dir");
  await symlink(join(root, "missing"), join(workspace, "dangling"), "dir");
  const options: ToolPermissionOptions = {
    permissionPreset: "workspace-write",
    protectedPaths: [storage],
  };
  const policy = new PermissionPolicy(workspace, options);
  try {
    options.permissionPreset = "danger-full-access";
    expect(policy.preset()).toBe("workspace-write");
    expect(await policy.checkWrite(join(workspace, "nested/new.txt"))).toBe(
      join(workspace, "nested/new.txt"),
    );
    for (const path of [
      join(root, "work-other/file"),
      join(workspace, "outside-link/file"),
      join(workspace, "dangling/file"),
      join(storage, "config"),
      workspace,
    ]) {
      await expect(policy.checkWrite(path)).rejects.toThrow("PERMISSION_DENIED");
    }
    await expect(policy.resolve(storage)).rejects.toThrow("overlaps protected");
    await expect(
      new PermissionPolicy(workspace, { permissionPreset: "read-only" }).checkWrite(
        join(workspace, "file"),
      ),
    ).rejects.toThrow("read-only");
    const full = new PermissionPolicy(workspace, { permissionPreset: "danger-full-access" });
    expect(await full.checkWrite(join(root, "outside"))).toBe(join(root, "outside"));
    expect(() =>
      validateFilePermissionArguments({ sandbox_permissions: "danger-full-access" }),
    ).toThrow("escalation is not supported");
    await rename(workspace, workspace + "-old");
    await symlink(workspace + "-old", workspace, "dir");
    await expect(policy.resolve()).rejects.toThrow("Workspace identity changed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
