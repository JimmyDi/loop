import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rename, rm, symlink } from "node:fs/promises";
import { join } from "node:path";

import { PermissionPolicy, rejectEscalation } from "./policy";
import type { ToolPermissionOptions } from "./types";

test("policy contains real paths, protects storage and freezes caller options", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".policy-test-"));
  const workspace = join(root, "work");
  const storage = join(workspace, "storage");
  await mkdir(storage, { recursive: true });
  await mkdir(join(root, "work-other"));
  await symlink(join(root, "work-other"), join(workspace, "outside-link"));
  await symlink(join(root, "missing"), join(workspace, "dangling"));
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
    expect(() => rejectEscalation({ sandbox_permissions: "danger-full-access" })).toThrow(
      "escalation is not supported",
    );
    await rename(workspace, workspace + "-old");
    await symlink(workspace + "-old", workspace);
    await expect(policy.resolve()).rejects.toThrow("Workspace identity changed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
