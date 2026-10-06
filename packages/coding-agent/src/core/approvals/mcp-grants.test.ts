import { expect, test } from "vitest";

import { McpGrants } from "./mcp-grants";

test("Full access allows live tools; restricted grants match one catalog and exact tool", () => {
  const grants = new McpGrants();
  const catalog = new AbortController();
  const tool = { lifetime: catalog.signal, toolKey: "read_file" };
  expect(grants.source(tool, false)).toBeUndefined();
  expect(grants.source(tool, true)).toBe("full-access");
  expect(grants.source(undefined, true)).toBeUndefined();
  grants.remember(tool);
  expect(grants.source(tool, false)).toBe("session-grant");
  expect(grants.source({ ...tool, toolKey: "write_file" }, false)).toBeUndefined();
  expect(grants.source({ ...tool, lifetime: new AbortController().signal }, false)).toBeUndefined();
  grants.clear();
  expect(grants.source(tool, false)).toBeUndefined();
  grants.remember(tool);
  catalog.abort();
  expect(grants.source(tool, true)).toBeUndefined();
  expect(grants.source(tool, false)).toBeUndefined();
});
