import { expect, test } from "vitest";

import { buildPermissionContext } from "./permission-context";

test("permission narration describes conditional approval without promising authority", () => {
  expect(buildPermissionContext(undefined, ".")).toBe("");
  const readOnly = buildPermissionContext("read-only", ".");
  expect(readOnly).toContain("File writes and edits are denied");
  expect(readOnly).toContain("no network access");
  expect(readOnly).toContain("Approval policy: ask");
  expect(readOnly).toContain("fail closed if no approval handler is available");
  expect(readOnly).toContain("Approval never changes the session preset");
  expect(readOnly).toContain("file approvals cannot modify protected Loop storage");

  const workspace = buildPermissionContext("workspace-write", ".");
  expect(workspace).toContain('session workspace: "."');
  expect(workspace).toContain("Loop storage remains protected");

  const full = buildPermissionContext("danger-full-access", ".");
  expect(full).toContain("Host user permissions still apply");
  expect(full).toContain("Approval policy: never");
  expect(full).not.toContain("no network access");
  expect(full).not.toContain("File writes and edits are denied");
});
