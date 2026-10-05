import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, rename, rm, symlink, unlink } from "node:fs/promises";
import { join } from "node:path";

import { ApprovalService } from "../approvals/approval-service";
import type { ToolApprovalContext } from "../approvals/tool-approvals";
import type { ApprovalRequest } from "../approvals/types";
import { createWriteTool } from "../tools/write";
import { createEditTool } from "../tools/edit";
import { PermissionPolicy } from "./policy";
import { approveFileWrite, snapshotFile } from "./file-approval";
import { writePermittedFile } from "./write-file";

test("file approvals reject changed contents, symlink targets and replaced parent directories", async () => {
  for (const change of ["contents", "symlink", "parent"] as const) {
    const root = await mkdtemp(join(import.meta.dir, ".file-approval-test-"));
    const work = join(root, "work");
    await mkdir(work);
    const target = join(work, "file");
    const original = join(work, "original");
    await Bun.write(change === "symlink" ? original : target, "old");
    if (change === "symlink") await symlink(original, target);
    const service = new ApprovalService(
      "test",
      () => "ask",
      () => {},
    );
    const ready = Promise.withResolvers<ApprovalRequest>();
    service.registerHandler((request) => {
      ready.resolve(request);
    });
    const controller = new AbortController();
    const args = { path: "file", edits: [{ oldText: "old", newText: "approved" }] };
    const context: ToolApprovalContext = {
      arguments: args,
      request: (operation, reason) =>
        service.request(
          { toolName: "edit", toolCallId: "call", reason, operation },
          { signal: controller.signal },
        ),
    };
    try {
      const running = Promise.resolve(
        createEditTool(work).execute(args, controller.signal, context),
      ).catch((error: unknown) => error);
      const request = await ready.promise;
      if (change === "contents") await Bun.write(target, "external edit");
      else if (change === "symlink") {
        await Bun.write(join(work, "other"), "old");
        await unlink(target);
        await symlink(join(work, "other"), target);
      } else {
        await rename(work, work + "-old");
        await mkdir(work);
        await Bun.write(target, "old");
      }
      expect(service.respond({ ...request, decision: "allowed-once" })).toBe(true);
      expect(await running).toBeInstanceOf(Error);
      expect(await Bun.file(target).text()).toBe(change === "contents" ? "external edit" : "old");
      expect((await readdir(work)).some((name) => name.endsWith(".tmp"))).toBe(false);
    } finally {
      controller.abort();
      service.dispose();
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("file rejection, timeout and cancellation never create directories or files", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".file-approval-test-"));
  try {
    for (const outcome of ["rejected", "timed-out", "cancelled", "unavailable"] as const) {
      const controller = new AbortController();
      const service = new ApprovalService(
        "test",
        () => "ask",
        () => {},
      );
      if (outcome !== "unavailable")
        service.registerHandler((request) => {
          if (outcome === "rejected") service.respond({ ...request, decision: "rejected" });
          if (outcome === "cancelled") controller.abort(new Error("cancelled"));
        });
      const args = { path: "nested/file", content: "blocked" };
      const context: ToolApprovalContext = {
        arguments: args,
        request: (operation, reason) =>
          service.request(
            { toolName: "write", toolCallId: "call", reason, operation },
            { signal: controller.signal, timeoutMs: 10 },
          ),
      };
      await expect(
        createWriteTool(root).execute(args, controller.signal, context),
      ).rejects.toThrow();
      expect(await readdir(root)).toEqual([]);
      service.dispose();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("file permits bind output and path, are consumed once and reject policy changes", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".file-approval-test-"));
  const service = new ApprovalService(
    "test",
    () => "ask",
    () => {},
  );
  service.registerHandler((request) => {
    service.respond({ ...request, decision: "allowed-once" });
  });
  let preset: "read-only" | "workspace-write" = "read-only";
  const policy = new PermissionPolicy(root, {}, () => preset);
  const path = join(root, "file");
  const signal = new AbortController().signal;
  const context: ToolApprovalContext = {
    arguments: { path: "file", content: "approved" },
    request: (operation, reason) =>
      service.request({ toolName: "write", toolCallId: "call", reason, operation }),
  };
  const getPermit = async () =>
    approveFileWrite(policy, path, path, "approved", await snapshotFile(path), signal, context);
  try {
    const permit = await getPermit();
    await expect(writePermittedFile(policy, path, "tampered", signal, permit)).rejects.toThrow(
      "does not match",
    );
    await expect(
      writePermittedFile(policy, join(root, "other"), "approved", signal, permit),
    ).rejects.toThrow("does not match");
    expect(await readdir(root)).toEqual([]);
    await writePermittedFile(policy, path, "approved", signal, permit);
    await expect(writePermittedFile(policy, path, "approved", signal, permit)).rejects.toThrow(
      "does not match",
    );
    const changed = await getPermit();
    preset = "workspace-write";
    await expect(writePermittedFile(policy, path, "approved", signal, changed)).rejects.toThrow(
      "policy changed",
    );
  } finally {
    service.dispose();
    await rm(root, { recursive: true, force: true });
  }
});
