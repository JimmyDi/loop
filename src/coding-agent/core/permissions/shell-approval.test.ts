import { expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

import { ApprovalService } from "../approvals/approval-service";
import type { ToolApprovalContext } from "../approvals/tool-approvals";
import { createBashTool } from "../tools/bash";
import { approveShell } from "./shell-approval";
import { PermissionPolicy } from "./policy";

test("shell escalation validates its request and never dispatches on failed approval", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".shell-approval-test-"));
  const policy = new PermissionPolicy(root);
  const signal = new AbortController().signal;
  try {
    for (const args of [
      { sandbox_permissions: "invalid" },
      { sandbox_permissions: "require_escalated" },
      { sandbox_permissions: "require_escalated", justification: " " },
      { justification: "no requested mode" },
    ])
      await expect(approveShell(policy, args, signal)).rejects.toThrow("PERMISSION_DENIED");
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
      const args = {
        command: "printf blocked > file",
        sandbox_permissions: "require_escalated",
        justification: "Write file",
      };
      const context: ToolApprovalContext = {
        arguments: args,
        request: (operation, reason) =>
          service.request(
            { toolName: "bash", toolCallId: "call", reason, operation },
            { signal: controller.signal, timeoutMs: 10 },
          ),
      };
      await expect(
        createBashTool(root).execute(args, controller.signal, context),
      ).rejects.toThrow();
      expect(await readdir(root)).toEqual([]);
      service.dispose();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
