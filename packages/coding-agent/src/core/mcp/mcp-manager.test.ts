import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { expect, test, vi } from "vitest";

import type { PermissionTool } from "../approvals/tool-approvals";
import { McpManager } from "./mcp-manager";
import type { McpConnection, McpConnector } from "./connection";
import type { McpServerConfig } from "./types";

const config = (id: string): McpServerConfig => ({
  id,
  name: id,
  enabled: true,
  transport: "stdio",
  command: "synthetic-command",
  args: [],
  env: [],
  envVars: [],
  cwd: "",
});

test("only STDIO saves extend discovery; enable, retry, startup and HTTP stay short", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-mcp-setup-"));
  const file = join(directory, "mcp.json");
  const attempts: { signal: AbortSignal; timeout?: number }[] = [];
  const connector: McpConnector = async (_config, signal, _changed, timeout) => {
    attempts.push({ signal, timeout });
    return new Promise(() => {});
  };
  const manager = new McpManager(file, connector);
  const timeout = vi.spyOn(AbortSignal, "timeout");
  try {
    await manager.save(config("example"), true);
    expect(attempts[0]!.timeout).toBe(120_000);
    expect(timeout).toHaveBeenLastCalledWith(120_000);
    expect((await manager.list())[0]!.status).toBe("connecting");
    expect(manager.tools(directory)).toEqual([]);
    expect(await readFile(file, "utf8")).not.toContain("setup");
    await manager.setEnabled("example", false);
    expect(attempts[0]!.signal.aborted).toBe(true);
    await manager.setEnabled("example", true);
    expect(attempts[1]!.timeout).toBeUndefined();
    expect(timeout).toHaveBeenLastCalledWith(15_000);
    manager.retry("example");
    await vi.waitFor(() => expect(attempts).toHaveLength(3));
    expect(attempts[2]!.timeout).toBeUndefined();
    expect(timeout).toHaveBeenLastCalledWith(15_000);
    await manager.save(config("example"));
    await vi.waitFor(() => expect(attempts).toHaveLength(4));
    expect(attempts[3]!.timeout).toBe(120_000);
    expect(attempts[2]!.signal.aborted).toBe(true);
    await manager.close();
    const restored = new McpManager(file, connector);
    try {
      await restored.list();
      expect(attempts.at(-1)!.timeout).toBeUndefined();
      expect(timeout).toHaveBeenLastCalledWith(15_000);
      await restored.save(
        {
          id: "http",
          name: "HTTP",
          enabled: true,
          transport: "http",
          url: "https://example.com/mcp",
          bearerTokenEnv: "",
          headers: [],
          envHeaders: [],
        },
        true,
      );
      expect(attempts.at(-1)!.timeout).toBeUndefined();
      expect(timeout).toHaveBeenLastCalledWith(15_000);
    } finally {
      await restored.close();
    }
  } finally {
    timeout.mockRestore();
    await manager.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("discovery is nonblocking, bounded and rejects stale results after disable/restart", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-mcp-manager-"));
  const attempts: {
    id: string;
    signal: AbortSignal;
    ready: ReturnType<typeof Promise.withResolvers<McpConnection>>;
  }[] = [];
  const connector: McpConnector = (value, signal) => {
    const ready = Promise.withResolvers<McpConnection>();
    attempts.push({ id: value.id, signal, ready });
    return ready.promise;
  };
  const manager = new McpManager(join(directory, "mcp.json"), connector);
  const close = vi.fn(async () => {});
  const connection: McpConnection = {
    tools: [{ name: "example", inputSchema: { type: "object", properties: {} } }],
    close,
    refresh: async () => [],
    call: async () => [],
  };
  try {
    for (const id of ["one", "two", "three", "four"]) await manager.save(config(id), true);
    expect(attempts).toHaveLength(3);
    expect((await manager.list()).map((item) => item.status)).toEqual([
      "connecting",
      "connecting",
      "connecting",
      "queued",
    ]);
    expect(manager.tools(directory)).toEqual([]);
    await manager.setEnabled("one", false);
    expect(attempts[0]!.signal.aborted).toBe(true);
    await vi.waitFor(() => expect(attempts).toHaveLength(4));
    attempts[0]!.ready.resolve(connection);
    await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
    attempts[1]!.ready.resolve({ ...connection, close: async () => {} });
    await vi.waitFor(() => expect(manager.tools(directory)).toHaveLength(1));
    const oldTool = manager.tools(directory)[0]!;
    await manager.setEnabled("two", false);
    await expect(oldTool.execute({}, new AbortController().signal)).rejects.toThrow();
    await manager.close();
    expect(attempts.every((attempt) => attempt.signal.aborted)).toBe(true);
  } finally {
    await manager.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("startup/read errors and failed connectors remain isolated; config survives restart", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-mcp-manager-"));
  const file = join(directory, "mcp.json");
  let attempts = 0;
  const connector: McpConnector = async () => {
    attempts++;
    throw new Error("synthetic private diagnostic");
  };
  const manager = new McpManager(file, connector);
  try {
    await manager.save(config("example"), true);
    await vi.waitFor(async () => expect((await manager.list())[0]!.status).toBe("error"));
    expect(JSON.stringify(await manager.list())).not.toContain("diagnostic");
    manager.retry("example");
    await vi.waitFor(() => expect(attempts).toBe(2));
    await manager.close();
    const restored = new McpManager(file, connector);
    expect((await restored.list())[0]!.name).toBe("example");
    await restored.close();
    await writeFile(file, "invalid");
    const broken = new McpManager(file, connector);
    await expect(broken.list()).rejects.toThrow("mcp_config_invalid");
    await expect(broken.save(config("another"), true)).rejects.toThrow("mcp_config_invalid");
    await broken.close();
  } finally {
    await manager.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("a hung connector times out and releases its discovery slot", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-mcp-timeout-"));
  const file = join(directory, "mcp.json");
  let attempts = 0;
  const manager = new McpManager(file, async () => {
    attempts++;
    return new Promise(() => {});
  });
  const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation(() => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);
    return controller.signal;
  });
  try {
    for (const id of ["one", "two", "three", "four"]) await manager.save(config(id), true);
    await vi.waitFor(() => expect(attempts).toBe(4));
    await vi.waitFor(async () =>
      expect((await manager.list()).every((item) => item.status === "error")).toBe(true),
    );
  } finally {
    timeout.mockRestore();
    await manager.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("catalog changes automatically refresh while invalidating old tool snapshots", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-mcp-catalog-"));
  const notifications: Parameters<McpConnector>[2][] = [];
  const manager = new McpManager(join(directory, "mcp.json"), async (_config, _signal, changed) => {
    notifications.push(changed);
    return {
      tools: [{ name: "example", inputSchema: { type: "object", properties: {} } }],
      close: async () => {},
      refresh: async () => [{ name: "updated", inputSchema: { type: "object", properties: {} } }],
      call: async () => [],
    };
  });
  try {
    await manager.save(config("example"), true);
    await vi.waitFor(() => expect(manager.tools(directory)).toHaveLength(1));
    await manager.save(config("example"));
    expect(notifications).toHaveLength(1);
    expect(manager.tools(directory)).toHaveLength(1);
    const tool = manager.tools(directory)[0]!;
    notifications[0]!("catalog");
    expect(manager.tools(directory)).toEqual([]);
    await vi.waitFor(async () =>
      expect((await manager.list())[0]).toMatchObject({ status: "ready", toolCount: 1 }),
    );
    await expect(tool.execute({}, new AbortController().signal)).rejects.toThrow();
    expect(manager.tools(directory)[0]!.description).toContain("updated");
    expect(notifications).toHaveLength(1);
    manager.retry("example");
    await vi.waitFor(() => expect(manager.tools(directory)).toHaveLength(1));
    notifications[0]!("closed");
    expect((await manager.list())[0]!.status).toBe("ready");
    expect(notifications).toHaveLength(2);
  } finally {
    await manager.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("catalog refresh coalesces notifications and cannot revive a disabled connection", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-mcp-refresh-"));
  let notify: Parameters<McpConnector>[2] = () => {};
  const catalog = [{ name: "updated", inputSchema: { type: "object" as const } }];
  const pending: ReturnType<typeof Promise.withResolvers<typeof catalog>>[] = [];
  const refresh = vi.fn(() => {
    const result = Promise.withResolvers<typeof catalog>();
    pending.push(result);
    return result.promise;
  });
  const close = vi.fn(async () => {});
  const manager = new McpManager(join(directory, "mcp.json"), async (_config, _signal, changed) => {
    notify = changed;
    return {
      tools: [{ name: "initial", inputSchema: { type: "object" } }],
      refresh,
      close,
      call: async () => [],
    };
  });
  try {
    await manager.save(config("example"), true);
    await vi.waitFor(() => expect(manager.tools(directory)).toHaveLength(1));
    notify("catalog");
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    notify("catalog");
    notify("catalog");
    expect((await manager.list())[0]!.status).toBe("refreshing");
    expect(manager.tools(directory)).toEqual([]);
    pending[0]!.resolve(catalog);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
    await manager.setEnabled("example", false);
    pending[1]!.resolve(catalog);
    await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect((await manager.list())[0]!.status).toBe("disabled");
    expect(manager.tools(directory)).toEqual([]);
  } finally {
    await manager.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("failed refresh preserves configuration and gives a safe actionable error", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-mcp-refresh-error-"));
  let notify: Parameters<McpConnector>[2] = () => {};
  const manager = new McpManager(join(directory, "mcp.json"), async (_config, _signal, changed) => {
    notify = changed;
    return {
      tools: [],
      refresh: async () => {
        throw new Error("synthetic private diagnostic");
      },
      close: async () => {},
      call: async () => [],
    };
  });
  try {
    await manager.save(config("example"), true);
    await vi.waitFor(async () => expect((await manager.list())[0]!.status).toBe("ready"));
    notify("catalog");
    await vi.waitFor(async () =>
      expect((await manager.list())[0]).toMatchObject({
        status: "error",
        error: "refresh_failed",
        enabled: true,
      }),
    );
    expect(JSON.stringify(await manager.list())).not.toContain("diagnostic");
  } finally {
    await manager.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("rename preserves a catalog lifetime; connection edits, refresh and disabling revoke it", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-mcp-lifetime-"));
  const file = join(directory, "mcp.json");
  const lifetimes: AbortSignal[] = [];
  const changes: ((event: "catalog" | "closed") => void)[] = [];
  const manager = new McpManager(file, async (_config, _signal, changed) => {
    changes.push(changed);
    return {
      tools: [
        { name: "read_file", inputSchema: { type: "object" } },
        { name: "write_file", inputSchema: { type: "object" } },
      ],
      call: async () => [],
      refresh: async () => [
        { name: "read_file", inputSchema: { type: "object" } },
        { name: "write_file", inputSchema: { type: "object" } },
      ],
      close: async () => {},
    };
  });
  const inspect = async () => {
    const tool = manager.tools(directory)[0]! as PermissionTool;
    await tool.execute({}, new AbortController().signal, {
      arguments: {},
      request: async (operation, reason, _signal, options) => {
        lifetimes.push(options!.mcp!.lifetime);
        return {
          request: {
            requestId: "request",
            sessionId: "session",
            toolCallId: "call",
            toolName: tool.name,
            reason,
            operation,
            policy: "ask",
            createdAt: 0,
            expiresAt: null,
          },
          outcome: "allowed-once",
          resolvedAt: 0,
        };
      },
    });
  };
  try {
    const saved = config("example");
    await manager.save(saved, true);
    await vi.waitFor(() => expect(manager.tools(directory)).toHaveLength(2));
    await inspect();
    await manager.save({ ...saved, name: "Renamed" });
    await inspect();
    expect(lifetimes[1]).toBe(lifetimes[0]);
    expect(lifetimes[0]!.aborted).toBe(false);
    await manager.save({
      ...saved,
      name: "Renamed",
      args: ["changed"],
    });
    expect(lifetimes[0]!.aborted).toBe(true);
    await vi.waitFor(() => expect(manager.tools(directory)).toHaveLength(2));
    const disk = JSON.parse(await readFile(file, "utf8"));
    expect(disk.servers[0]).toMatchObject({
      args: ["changed"],
    });
    expect((await manager.list())[0]!.toolCount).toBe(2);
    await inspect();
    changes.at(-1)!("catalog");
    expect(lifetimes[2]!.aborted).toBe(true);
    await vi.waitFor(() => expect(manager.tools(directory)).toHaveLength(2));
    await inspect();
    await manager.setEnabled("example", false);
    expect(lifetimes.at(-1)!.aborted).toBe(true);
    expect(manager.tools(directory)).toEqual([]);
  } finally {
    await manager.close();
    await rm(directory, { recursive: true, force: true });
  }
});
