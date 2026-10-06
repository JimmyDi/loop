import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { expect, test, vi } from "vitest";

import { readMcpToolCatalog } from "./tool-catalog";

test("resources-only servers are connected without an unsupported tools/list request", async () => {
  const listTools = vi.fn();
  const client = {
    getServerCapabilities: () => ({ resources: {} }),
    listTools,
  } as unknown as Client;
  expect(await readMcpToolCatalog(client, new AbortController().signal)).toEqual([]);
  expect(listTools).not.toHaveBeenCalled();
});

test("rejects cyclic cursors and duplicate names without publishing a partial catalog", async () => {
  const tool = { name: "example", inputSchema: { type: "object" } };
  const listTools = vi.fn(async () => ({ tools: [tool], nextCursor: "same" }));
  const client = { getServerCapabilities: () => ({ tools: {} }), listTools } as unknown as Client;
  await expect(readMcpToolCatalog(client, new AbortController().signal)).rejects.toThrow(
    "invalid_catalog",
  );
  expect(listTools).toHaveBeenCalledTimes(2);
  listTools.mockImplementation(async () => ({ tools: [tool, tool], nextCursor: "" }));
  await expect(readMcpToolCatalog(client, new AbortController().signal)).rejects.toThrow(
    "invalid_catalog",
  );
});
