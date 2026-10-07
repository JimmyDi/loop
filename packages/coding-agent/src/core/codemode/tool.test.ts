import type { AgentTool } from "@loop/agent";
import { expect, test, vi } from "vitest";

import { ToolApprovals } from "../approvals/tool-approvals";
import { ApprovalService } from "../approvals/approval-service";
import type { ApprovalRequest } from "../approvals/types";
import { createMcpTools } from "../mcp/mcp-tools";
import { createCodemodeTool } from "./tool";

const run = (tools: AgentTool[], code: string, signal = new AbortController().signal) => {
  const bridge = new ToolApprovals(async () => {
    throw new Error("Unexpected approval");
  });
  bridge.onEvent({
    type: "tool_execution_start",
    toolCallId: "script",
    toolName: "codemode",
    args: { code },
  });
  const tool = bridge.bind([
    createCodemodeTool(tools, [
      { id: "fixture", name: "Fixture", toolNames: tools.map((tool) => tool.name) },
    ]),
  ])[0]!;
  return tool.execute({ code }, signal);
};

test("discovers schemas and invokes MCP tools sequentially while returning selected output only", async () => {
  let active = 0;
  const call = vi.fn(async () => {
    expect(active++).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active--;
    return [
      {
        type: "text" as const,
        text: JSON.stringify({ title: "selected", extra: "large unused output".repeat(100) }),
      },
    ];
  });
  const tool: AgentTool = {
    name: "mcp_fixture_read",
    description: "Read fixture data",
    parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
    execute: call,
  };
  const content = await run(
    [tool],
    `
    const matches = await searchTools("read", {namespace: "fixture"});
    const schema = await describeTool(matches[0].name);
    text(schema.parameters.required);
    const results = await Promise.all([tools[matches[0].name]({path: "one"}), tools[matches[0].name]({path: "two"})]);
    text(results.map(result => JSON.parse(result.content[0].text).title));
  `,
  );
  expect(call).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(content)).toContain("selected");
  expect(JSON.stringify(content)).not.toContain("large unused output");
});

test("nested invalid arguments do not dispatch and failures preserve partial output", async () => {
  const call = vi.fn(() => []);
  await expect(
    run(
      [
        {
          name: "example",
          description: "Example",
          parameters: {
            type: "object",
            properties: { path: { type: "string" } },
            required: ["path"],
          },
          execute: call,
        },
      ],
      'text("before failure"); await tools.example({});',
    ),
  ).rejects.toThrow("before failure");
  expect(call).not.toHaveBeenCalled();
});

test("sandbox has no host globals, modules or network and terminates infinite loops", async () => {
  const result = await run(
    [],
    "text([typeof process, typeof require, typeof fetch, typeof setTimeout]);",
  );
  expect(JSON.stringify(result)).toContain("undefined");
  await expect(run([], '// @options: {"timeout_ms": 100}\nwhile(true) {}')).rejects.toThrow(
    "timeout",
  );
  const after = await run([], 'return "fresh worker";');
  expect(JSON.stringify(after)).toContain("fresh worker");
});

test("cancellation ends a pending nested call and unawaited calls receive an aborted signal", async () => {
  const started = Promise.withResolvers<AbortSignal>();
  const tool: AgentTool = {
    name: "pending",
    description: "Pending",
    parameters: { type: "object" },
    execute: async (_args, signal) => {
      started.resolve(signal);
      return new Promise(() => {});
    },
  };
  const controller = new AbortController();
  const execution = run([tool], "await tools.pending({});", controller.signal);
  const nestedSignal = await started.promise;
  controller.abort(new Error("Cancelled fixture"));
  await expect(execution).rejects.toThrow("Cancelled fixture");
  expect(nestedSignal.aborted).toBe(true);
  const abandoned = Promise.withResolvers<AbortSignal>();
  await run(
    [
      {
        ...tool,
        execute: async (_args, signal) => {
          abandoned.resolve(signal);
          return new Promise(() => {});
        },
      },
    ],
    'tools.pending({}); return "finished";',
  );
  expect((await abandoned.promise).aborted).toBe(true);
});

test("script call and output limits prevent runaway tool batches and oversized model results", async () => {
  const call = vi.fn(() => []);
  await expect(
    run(
      [{ name: "example", description: "Example", parameters: { type: "object" }, execute: call }],
      "for(let i=0;i<65;i++) await tools.example({});",
    ),
  ).rejects.toThrow("64-call limit");
  expect(call).toHaveBeenCalledTimes(64);
  const content = await run([], 'text("长".repeat(20000));');
  expect(Buffer.byteLength(JSON.stringify(content))).toBeLessThan(21 * 1024);
  expect(JSON.stringify(content)).toContain("Output truncated");
  await expect(run([], '// @options: {"timeout_ms": 300001}\nreturn 1;')).rejects.toThrow(
    "five minutes",
  );
});

test("nested MCP approval binds each tool, reuses only exact grants and rejects revoked catalogs", async () => {
  const lifetime = new AbortController();
  const dispatch = vi.fn(async () => [{ type: "text" as const, text: "synthetic result" }]);
  const tools = createMcpTools(
    {
      id: "fixture",
      name: "Fixture",
      enabled: true,
      transport: "stdio",
      command: "synthetic-command",
      args: [],
      env: [],
      envVars: [],
      cwd: "",
    },
    {
      tools: ["read", "write"].map((name) => ({
        name,
        inputSchema: {
          type: "object",
          properties: { value: { type: "string" } },
          required: ["value"],
        },
      })),
      call: dispatch,
      refresh: async () => [],
      close: async () => {},
    },
    lifetime.signal,
    () => !lifetime.signal.aborted,
    ".",
  );
  const received: ApprovalRequest[] = [];
  const approvals = new ApprovalService(
    "fixture-session",
    () => "ask",
    () => {},
  );
  approvals.registerHandler((request) => {
    received.push(structuredClone(request));
    approvals.respond({
      ...request,
      decision:
        request.operation?.kind === "mcp-tool" && request.operation.toolName === "read"
          ? "allowed-session"
          : "rejected",
    });
  });
  const bridge = new ToolApprovals((input, options) => approvals.request(input, options));
  const execute = async (id: string, code: string) => {
    bridge.onEvent({
      type: "tool_execution_start",
      toolName: "codemode",
      toolCallId: id,
      args: { code },
    });
    return bridge
      .bind([
        createCodemodeTool(tools, [
          { id: "fixture", name: "Fixture", toolNames: tools.map((tool) => tool.name) },
        ]),
      ])[0]!
      .execute({ code }, new AbortController().signal);
  };
  try {
    await execute(
      "first",
      'const found = await describeNamespace("fixture"); const read = found.find(row => row.description.includes("Tool: read.")); text(await tools[read.name]({value: "one"})); text(await tools[read.name]({value: "two"}));',
    );
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      toolCallId: "first/1",
      toolName: tools[0]!.name,
      allowSession: true,
      operation: { kind: "mcp-tool", toolName: "read", arguments: { value: "one" } },
    });
    await execute(
      "second",
      'text(await tools[ALL_TOOLS.find(row => row.description.includes("Tool: read.")).name]({value: "three"}));',
    );
    expect(received).toHaveLength(1);
    expect(dispatch).toHaveBeenCalledTimes(3);
    await expect(
      execute(
        "denied",
        'await tools[ALL_TOOLS.find(row => row.description.includes("Tool: write.")).name]({value: "blocked"});',
      ),
    ).rejects.toThrow("approval was not granted");
    expect(received[1]).toMatchObject({
      toolCallId: "denied/1",
      toolName: tools[1]!.name,
      operation: { arguments: { value: "blocked" } },
    });
    expect(dispatch).toHaveBeenCalledTimes(3);
    lifetime.abort();
    await expect(
      execute("revoked", 'await tools[ALL_TOOLS[0].name]({value: "stale"});'),
    ).rejects.toThrow();
    expect(dispatch).toHaveBeenCalledTimes(3);
  } finally {
    approvals.dispose();
  }
});

test("partial effects are reported without replaying completed calls on script failure", async () => {
  const dispatch = vi.fn(() => [{ type: "text" as const, text: "effect completed" }]);
  await expect(
    run(
      [
        {
          name: "effect",
          description: "Effect",
          parameters: { type: "object" },
          execute: dispatch,
        },
      ],
      'text((await tools.effect({})).content); throw new Error("later failure");',
    ),
  ).rejects.toThrow("not rolled back");
  expect(dispatch).toHaveBeenCalledOnce();
});

test("catching a call-limit failure cannot keep a script running", async () => {
  const dispatch = vi.fn(() => []);
  await expect(
    run(
      [
        {
          name: "fixture",
          description: "Fixture",
          parameters: { type: "object" },
          execute: dispatch,
        },
      ],
      "while (true) { try { await tools.fixture({}); } catch {} }",
    ),
  ).rejects.toThrow("64-call limit");
  expect(dispatch).toHaveBeenCalledTimes(64);
});
