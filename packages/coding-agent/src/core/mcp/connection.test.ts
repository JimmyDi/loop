import { createServer } from "node:http";
import { once } from "node:events";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { expect, test, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { connectMcp } from "./connection";

test("STDIO initializes, discovers and calls tools with explicit environment and working directory", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-mcp-stdio-"));
  const script = join(directory, "server.mjs");
  // Test-only protocol fixture; no network or package execution.
  await writeFile(
    script,
    `
import { createInterface } from "node:readline";
const lines = createInterface({ input: process.stdin });
let catalogs = 0;
lines.on("line", (line) => {
  const request = JSON.parse(line);
  if (request.id === undefined) return;
  let result;
  if (request.method === "initialize") result = { protocolVersion: request.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: "fixture", version: "1" } };
  else if (request.method === "tools/list") result = { tools: [{ name: "example", description: "Catalog " + (++catalogs), inputSchema: { type: "object", properties: { value: { type: "string" } }, required: ["value"] } }] };
  else if (request.method === "tools/call") result = { content: [{ type: "text", text: JSON.stringify({ value: request.params.arguments.value, env: process.env.LOOP_MCP_SYNTHETIC, cwd: process.cwd() }) }] };
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }) + String.fromCharCode(10));
  if (request.method === "tools/call") process.stdout.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/tools/list_changed" }) + String.fromCharCode(10));
});
`,
  );
  const controller = new AbortController();
  const changed = vi.fn();
  const initialize = vi.spyOn(Client.prototype, "connect");
  const connection = await connectMcp(
    {
      id: "fixture",
      name: "Fixture",
      enabled: true,
      transport: "stdio",
      command: process.execPath,
      args: [script],
      env: [{ key: "LOOP_MCP_SYNTHETIC", value: "test-value" }],
      envVars: [],
      cwd: directory,
    },
    controller.signal,
    changed,
    120_000,
  );
  try {
    expect(initialize.mock.calls[0]![1]).toMatchObject({ timeout: 120_000 });
    expect(connection.tools[0]!.name).toBe("example");
    const result = await connection.call("example", { value: "input" }, controller.signal);
    expect(result[0]).toMatchObject({ type: "text" });
    if (result[0]?.type !== "text") throw new Error();
    expect(JSON.parse(result[0].text)).toEqual({
      value: "input",
      env: "test-value",
      cwd: await realpath(directory),
    });
    await vi.waitFor(() => expect(changed).toHaveBeenCalledWith("catalog"));
    expect((await connection.refresh(controller.signal))[0]!.description).toBe("Catalog 2");
  } finally {
    initialize.mockRestore();
    await connection.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("Streamable HTTP sends configured headers, paginates discovery and preserves image results", async () => {
  const seen: string[] = [];
  const server = createServer(async (request, response) => {
    if (request.method !== "POST") {
      response.writeHead(405).end();
      return;
    }
    let body = "";
    for await (const part of request) body += part;
    const message = JSON.parse(body);
    seen.push(message.method);
    expect(request.headers["x-example"]).toBe("synthetic-value");
    if (message.id === undefined) {
      response.writeHead(202).end();
      return;
    }
    const result =
      message.method === "initialize"
        ? {
            protocolVersion: message.params.protocolVersion,
            capabilities: { tools: {} },
            serverInfo: { name: "fixture", version: "1" },
          }
        : message.method === "tools/list"
          ? {
              tools: [
                {
                  name: message.params?.cursor ? "second" : "first",
                  inputSchema: { type: "object", properties: {} },
                },
              ],
              ...(message.params?.cursor ? {} : { nextCursor: "page-two" }),
            }
          : {
              content: [
                { type: "image", data: "AA==", mimeType: "image/png" },
                { type: "text", text: "synthetic result" },
              ],
            };
    response
      .writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error();
  const signal = new AbortController().signal;
  const changed = vi.fn();
  const initialize = vi.spyOn(Client.prototype, "connect");
  const connection = await connectMcp(
    {
      id: "fixture",
      name: "Fixture",
      enabled: true,
      transport: "http",
      url: "http://127.0.0.1:" + address.port + "/mcp",
      bearerTokenEnv: "",
      headers: [{ key: "X-Example", value: "synthetic-value" }],
      envHeaders: [],
    },
    signal,
    changed,
  );
  try {
    expect(initialize.mock.calls[0]![1]).toMatchObject({ timeout: 10_000 });
    expect(connection.tools.map((tool) => tool.name)).toEqual(["first", "second"]);
    expect(seen).not.toContain("tools/call");
    expect(await connection.call("first", {}, signal)).toEqual([
      { type: "image", data: "AA==", mimeType: "image/png" },
      { type: "text", text: "synthetic result" },
    ]);
    expect(seen.filter((method) => method === "tools/call")).toHaveLength(1);
  } finally {
    initialize.mockRestore();
    await connection.close();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  }
  expect(changed).not.toHaveBeenCalled();
});

test("connection cancellation and missing references fail without leaking diagnostics", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    connectMcp(
      {
        id: "fixture",
        name: "Fixture",
        enabled: true,
        transport: "stdio",
        command: process.execPath,
        args: [],
        env: [],
        envVars: [],
        cwd: "",
      },
      controller.signal,
      () => {},
    ),
  ).rejects.toThrow("connection_failed");
  await expect(
    connectMcp(
      {
        id: "fixture",
        name: "Fixture",
        enabled: true,
        transport: "http",
        url: "https://example.com/mcp",
        bearerTokenEnv: "LOOP_MCP_SYNTHETIC_MISSING_REFERENCE",
        headers: [],
        envHeaders: [],
      },
      new AbortController().signal,
      () => {},
    ),
  ).rejects.toThrow("missing_environment");
});
