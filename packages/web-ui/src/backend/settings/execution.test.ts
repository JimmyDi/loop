import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, test, vi } from "vitest";

import { McpManager } from "@loop/coding-agent";
import { executionConfiguration, requestedExecution } from "./execution";

afterEach(() => vi.unstubAllEnvs());

test("browser selects a configured environment without receiving credentials", async () => {
  vi.stubEnv("LOOP_SANDBOX_URL", "http://localhost:8080/mcp/");
  vi.stubEnv("LOOP_SANDBOX_TOKEN", "synthetic-only");
  expect(await executionConfiguration()).toEqual({ sandboxAvailable: true, servers: [] });
  expect(await requestedExecution("sandbox")).toEqual({
    type: "sandbox",
    url: "http://localhost:8080/mcp/",
    tokenEnv: "LOOP_SANDBOX_TOKEN",
  });
  await expect(
    requestedExecution({ type: "sandbox", url: "http://example.test/" }),
  ).rejects.toThrow();
  vi.stubEnv("LOOP_SANDBOX_TOKEN", "");
  await expect(requestedExecution("sandbox")).rejects.toThrow();
  expect(await requestedExecution("local")).toEqual({ type: "local" });
});

test("Web discovers a saved connection and never returns its credential", async () => {
  const directory = mkdtempSync(join(tmpdir(), "loop-web-credential-"));
  vi.stubEnv("LOOP_DATA_DIR", directory);
  vi.stubEnv("LOOP_SANDBOX_URL", "");
  vi.stubEnv("LOOP_SANDBOX_TOKEN", "");
  writeFileSync(
    join(directory, "sandbox-connection.json"),
    JSON.stringify({
      url: "https://sandbox.example/mcp/",
      store: "file",
      account: "00000000-0000-0000-0000-000000000000",
      token: "synthetic-web-credential",
    }),
    { mode: 0o600 },
  );
  try {
    expect(await executionConfiguration()).toEqual({ sandboxAvailable: true, servers: [] });
    expect(await requestedExecution("sandbox")).toEqual({
      type: "sandbox",
      url: "https://sandbox.example/mcp/",
      tokenEnv: "LOOP_SANDBOX_TOKEN",
    });
    expect(JSON.stringify(await requestedExecution("sandbox"))).not.toContain(
      "synthetic-web-credential",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("configured MCP execution lists providers and stores only a validated reference", async () => {
  const directory = mkdtempSync(join(tmpdir(), "loop-mcp-selection-"));
  vi.stubEnv("LOOP_DATA_DIR", directory);
  vi.stubEnv("LOOP_SANDBOX_URL", "");
  const manager = new McpManager(join(directory, "mcp.json"));
  try {
    await manager.save(
      {
        id: "provider",
        name: "My sandbox",
        enabled: true,
        transport: "http",
        url: "https://sandbox.example/mcp/",
        bearerTokenEnv: "",
        headers: [],
        envHeaders: [],
      },
      true,
    );
    expect((await executionConfiguration(manager)).servers[0]).toMatchObject({
      id: "provider",
      name: "My sandbox",
    });
    expect(await requestedExecution("mcp:provider", manager)).toEqual({
      type: "sandbox",
      serverId: "provider",
    });
    await manager.setEnabled("provider", false);
    await expect(requestedExecution("mcp:provider", manager)).rejects.toThrow();
    await expect(requestedExecution("mcp:unknown", manager)).rejects.toThrow();
  } finally {
    await manager.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
