import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import { expect, test } from "vitest";
import { McpManager } from "@loop/coding-agent";

import { createRouter } from "../router";
import type { SessionRegistry } from "../session-registry";

test("local-only MCP CRUD saves write-only settings and never waits for discovery", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-mcp-route-"));
  const manager = new McpManager(join(directory, "mcp.json"), async () => new Promise(() => {}));
  const route = createRouter({} as SessionRegistry, undefined, undefined, manager);
  const request = (path: string, method = "GET", body?: unknown, headers?: HeadersInit) =>
    route(
      new Request("http://localhost/api/settings/mcp" + path, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
  const config = {
    id: "example",
    name: "Example",
    enabled: true,
    transport: "http",
    url: "https://example.com/mcp",
    bearerTokenEnv: "",
    headers: [{ key: "X-Example", value: "synthetic-value" }],
    envHeaders: [],
  };
  try {
    const response = await request("", "POST", config);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.servers[0]).toMatchObject({
      status: "connecting",
      headers: [{ key: "X-Example", value: "", saved: true }],
    });
    expect(JSON.stringify(body)).not.toContain("synthetic-value");
    expect((await request("", "POST", config)).status).toBe(409);
    expect((await request("/example", "PUT", { ...body.servers[0], name: "Renamed" })).status).toBe(
      200,
    );
    expect((await request("/example/enabled", "PATCH", { enabled: false })).status).toBe(200);
    expect((await request("/example/enabled", "PATCH", { enabled: "yes" })).status).toBe(400);
    expect((await request("", "POST", config, { Origin: "https://example.com" })).status).toBe(403);
    expect((await request("/example", "PUT", { ...config, id: "other" })).status).toBe(400);
    expect((await request("/missing/retry", "POST")).status).toBe(404);
    expect((await request("/example", "DELETE")).status).toBe(200);
    expect(await (await request("")).json()).toEqual({ servers: [] });
  } finally {
    await manager.close();
    await rm(directory, { recursive: true, force: true });
  }
});
