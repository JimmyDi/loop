import { expect, test, vi } from "vitest";

import type { McpConnection } from "./connection";
import { createMcpTools } from "./mcp-tools";
import { ToolApprovals } from "../approvals/tool-approvals";
import { ApprovalService } from "../approvals/approval-service";
import type { McpServerConfig } from "./types";

test("restricted external calls require exact approval and expire after configuration changes", async () => {
  const config: McpServerConfig = {
    id: "example",
    name: "Example",
    enabled: true,
    transport: "http",
    url: "https://example.com/mcp",
    bearerTokenEnv: "",
    headers: [],
    envHeaders: [],
  };
  const lifetime = new AbortController();
  const call = vi.fn(async () => [{ type: "text" as const, text: "synthetic result" }]);
  const service = new ApprovalService(
    "session",
    () => "ask",
    () => {},
  );
  const approvals = new ToolApprovals((input, options) => service.request(input, options));
  let current = true;
  const tools = createMcpTools(
    config,
    {
      tools: [
        {
          name: "example",
          inputSchema: { type: "object", properties: { value: { type: "string" } } },
        },
      ],
      call,
      refresh: async () => [],
      close: async () => {},
    },
    lifetime.signal,
    () => current,
    ".",
  );
  const tool = approvals.bind(tools)[0]!;
  expect(tools[0]!.displayName).toBe("Example · example");
  expect(tool.name).toMatch(/^mcp_example_example_[a-f0-9]{16}$/);
  const start = () =>
    approvals.onEvent({
      type: "tool_execution_start",
      toolName: tool.name,
      toolCallId: "call-id",
      args: { value: "test" },
    });
  start();
  await expect(tool.execute({ value: "test" }, new AbortController().signal)).rejects.toThrow(
    "approval was not granted",
  );
  expect(call).not.toHaveBeenCalled();
  const detach = service.registerHandler((request) => {
    service.respond({ ...request, decision: "allowed-once" });
  });
  start();
  await tool.execute({ value: "test" }, new AbortController().signal);
  expect(call).toHaveBeenCalledOnce();
  expect(call).toHaveBeenCalledWith("example", { value: "test" }, expect.any(AbortSignal));
  detach();
  service.registerHandler(() => {
    current = false;
    lifetime.abort();
  });
  start();
  await expect(tool.execute({ value: "test" }, new AbortController().signal)).rejects.toThrow();
  expect(service.pending).toEqual([]);
  expect(call).toHaveBeenCalledOnce();
  service.dispose();
});

test("MCP calls follow session permissions regardless of server-declared read-only hints", async () => {
  for (const full of [false, true]) {
    const config: McpServerConfig = {
      id: "example",
      name: "Example",
      enabled: true,
      transport: "http",
      url: "https://example.com/mcp",
      bearerTokenEnv: "",
      headers: [],
      envHeaders: [],
    };
    const call = vi.fn(async () => []);
    const handler = vi.fn((request) => {
      service.respond({ ...request, decision: "rejected" });
    });
    const service = new ApprovalService(
      "session",
      () => (full ? "never" : "ask"),
      () => {},
      () => full,
    );
    service.registerHandler(handler);
    const approvals = new ToolApprovals((input, options) => service.request(input, options));
    const connection: McpConnection = {
      tools: [true, false].map((readOnlyHint) => ({
        name: readOnlyHint ? "declared_read" : "declared_write",
        annotations: { readOnlyHint },
        inputSchema: { type: "object" },
      })),
      call,
      refresh: async () => [],
      close: async () => {},
    };
    const tools = approvals.bind(
      createMcpTools(config, connection, new AbortController().signal, () => true, "."),
    );
    expect(
      createMcpTools(
        { ...config, enabled: false },
        connection,
        new AbortController().signal,
        () => true,
        ".",
      ),
    ).toEqual([]);
    for (const tool of tools) {
      approvals.onEvent({
        type: "tool_execution_start",
        toolName: tool.name,
        toolCallId: tool.name,
        args: {},
      });
      if (full) await tool.execute({}, new AbortController().signal);
      else
        await expect(tool.execute({}, new AbortController().signal)).rejects.toThrow(
          "approval was not granted",
        );
    }
    expect(call).toHaveBeenCalledTimes(full ? 2 : 0);
    expect(handler).toHaveBeenCalledTimes(full ? 0 : 2);
    service.dispose();
  }
});

test("session approval covers one tool across prompts, not other tools, servers or live sessions", async () => {
  const config: McpServerConfig = {
    id: "example",
    name: "Example",
    enabled: true,
    transport: "http",
    url: "https://example.com/mcp",
    bearerTokenEnv: "",
    headers: [],
    envHeaders: [],
  };
  const catalog = new AbortController();
  const otherCatalog = new AbortController();
  const call = vi.fn(async () => []);
  const connection: McpConnection = {
    tools: ["read_file", "write_file"].map((name) => ({ name, inputSchema: { type: "object" } })),
    call,
    refresh: async () => [],
    close: async () => {},
  };
  const service = new ApprovalService(
    "first",
    () => "ask",
    () => {},
  );
  const handler = vi.fn((request) => {
    service.respond({ ...request, decision: "allowed-session" });
  });
  service.registerHandler(handler);
  const approvals = new ToolApprovals((input, options) => service.request(input, options));
  const execute = async (index: number, lifetime = catalog.signal, value = "first") => {
    const tool = approvals.bind(createMcpTools(config, connection, lifetime, () => true, "."))[
      index
    ]!;
    approvals.onEvent({
      type: "tool_execution_start",
      toolName: tool.name,
      toolCallId: crypto.randomUUID(),
      args: { value },
    });
    await tool.execute({ value }, new AbortController().signal);
  };
  await execute(0);
  await execute(0, catalog.signal, "different parameters");
  expect(handler).toHaveBeenCalledOnce();
  await execute(1);
  await execute(0, otherCatalog.signal);
  expect(handler).toHaveBeenCalledTimes(3);
  catalog.abort();
  await expect(execute(0)).rejects.toThrow();
  expect(call).toHaveBeenCalledTimes(4);
  const second = new ApprovalService(
    "second",
    () => "ask",
    () => {},
  );
  const next = new ToolApprovals((input, options) => second.request(input, options));
  const tool = next.bind(
    createMcpTools(config, connection, otherCatalog.signal, () => true, "."),
  )[0]!;
  next.onEvent({ type: "tool_execution_start", toolName: tool.name, toolCallId: "call", args: {} });
  await expect(tool.execute({}, new AbortController().signal)).rejects.toThrow(
    "approval was not granted",
  );
  expect(call).toHaveBeenCalledTimes(4);
  service.dispose();
  second.dispose();
});

test("automatic grants do not bypass cancellation, stale connections or server failures", async () => {
  const config: McpServerConfig = {
    id: "example",
    name: "Example",
    enabled: true,
    transport: "http",
    url: "https://example.com/mcp",
    bearerTokenEnv: "",
    headers: [],
    envHeaders: [],
  };
  const call = vi.fn(async () => {
    throw new Error("synthetic access denied");
  });
  let current = true;
  const lifetime = new AbortController();
  const events: import("../approvals/types").ApprovalEvent[] = [];
  const service = new ApprovalService(
    "session",
    () => "never",
    (event) => events.push(event),
    () => true,
  );
  const approvals = new ToolApprovals((input, options) => service.request(input, options));
  const tool = approvals.bind(
    createMcpTools(
      config,
      {
        tools: [{ name: "example", inputSchema: { type: "object" } }],
        call,
        refresh: async () => [],
        close: async () => {},
      },
      lifetime.signal,
      () => current,
      ".",
    ),
  )[0]!;
  const execute = () => {
    approvals.onEvent({
      type: "tool_execution_start",
      toolName: tool.name,
      toolCallId: "call",
      args: {},
    });
    return tool.execute({}, new AbortController().signal);
  };
  await expect(execute()).rejects.toThrow("MCP tool failed");
  expect(events.at(-1)).toMatchObject({
    type: "approval_resolved",
    result: { source: "full-access", outcome: "allowed-once" },
  });
  current = false;
  await expect(execute()).rejects.toThrow("no longer available");
  current = true;
  lifetime.abort();
  await expect(execute()).rejects.toThrow();
  expect(call).toHaveBeenCalledOnce();
  service.dispose();
});
