import { expect, test } from "bun:test";

import { buildPermissionContext } from "./permission-context";

test("permission narration describes only the active policy and never promises approval", () => {
  expect(buildPermissionContext(undefined, ".")).toBe("");
  const readOnly = buildPermissionContext("read-only", ".");
  expect(readOnly).toContain("File writes and edits are denied");
  expect(readOnly).toContain("no network access");
  expect(readOnly).toContain("Approval policy: ask");
  expect(readOnly).toContain("Approval and escalation are unavailable");

  const workspace = buildPermissionContext("workspace-write", ".");
  expect(workspace).toContain('session workspace: "."');
  expect(workspace).toContain("Loop storage remains protected");

  const full = buildPermissionContext("danger-full-access", ".");
  expect(full).toContain("Host user permissions still apply");
  expect(full).toContain("Approval policy: never");
  expect(full).not.toContain("no network access");
  expect(full).not.toContain("File writes and edits are denied");
});
