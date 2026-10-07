import type { AgentTool } from "@loop/agent";

import { readMcpConfigs, writeMcpConfigs, mergeMcpSecrets, redactMcpConfig } from "./config-store";
import { connectMcp } from "./connection";
import type { McpConnection, McpConnector } from "./connection";
import { discoverMcp, MCP_SETUP_TIMEOUT_MS } from "./discovery";
import { mcpFailureCode } from "./connection-errors";
import { createMcpTools } from "./mcp-tools";
import { McpConfigError } from "./types";
import type { McpFailureCode, McpServerConfig, McpServerView, McpStatus } from "./types";
import { validateMcpConfig } from "./validate-config";

type Entry = {
  config: McpServerConfig;
  status: McpStatus;
  controller: AbortController;
  connection?: McpConnection;
  catalog: AbortController;
  error?: McpFailureCode;
  dirty?: boolean;
  setup?: boolean;
};

export type McpPromptServer = {
  id: string;
  name: string;
  instructions?: string;
  toolNames: string[];
};

export type McpToolSnapshot = {
  tools: AgentTool[];
  servers: McpPromptServer[];
};

/** Shared application resource owner. Starting discovery never waits for a server. */
export class McpManager {
  private entries = new Map<string, Entry>();
  private tail: Promise<unknown>;
  private active = 0;
  private disposed = false;
  private closing = new Set<Promise<void>>();
  private failure?: string;

  constructor(
    private readonly file: string,
    private readonly connector: McpConnector = connectMcp,
  ) {
    this.tail = readMcpConfigs(file)
      .then((configs) => {
        if (!this.disposed) this.replace(configs);
      })
      .catch((error) => {
        this.failure = error instanceof McpConfigError ? error.code : "mcp_config_unreadable";
      });
  }

  async list(): Promise<McpServerView[]> {
    await this.tail;
    if (this.failure) throw new McpConfigError(this.failure);
    return [...this.entries.values()].map(({ config, status, connection, error }) => ({
      ...redactMcpConfig(config),
      status,
      toolCount: status === "ready" ? (connection?.tools.length ?? 0) : 0,
      ...(error ? { error } : {}),
    }));
  }

  save(input: unknown, create = false): Promise<void> {
    const value = validateMcpConfig(input);
    return this.update((configs) => {
      const previous = configs.find((config) => config.id === value.id);
      if (create && previous) throw new McpConfigError("mcp_exists");
      if (!create && !previous) throw new McpConfigError("mcp_not_found");
      const config = mergeMcpSecrets(value, previous);
      return previous
        ? configs.map((item) => (item.id === value.id ? config : item))
        : [...configs, config];
    }, value.id);
  }

  setEnabled(id: string, enabled: boolean): Promise<void> {
    if (typeof enabled !== "boolean") throw new McpConfigError("invalid_mcp_config");
    return this.update((configs) => {
      if (!configs.some((config) => config.id === id)) throw new McpConfigError("mcp_not_found");
      return configs.map((config) => (config.id === id ? { ...config, enabled } : config));
    });
  }

  remove(id: string): Promise<void> {
    return this.update((configs) => {
      if (!configs.some((config) => config.id === id)) throw new McpConfigError("mcp_not_found");
      return configs.filter((config) => config.id !== id);
    });
  }

  retry(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) throw new McpConfigError("mcp_not_found");
    if (!entry.config.enabled || this.disposed) return;
    this.retire(entry);
    this.entries.set(id, this.entry(entry.config));
    this.pump();
  }

  tools(workspaceRoot: string): AgentTool[] {
    return this.snapshot(workspaceRoot).tools;
  }

  /** Capture ready service summaries and their callable tools together without waiting. */
  snapshot(workspaceRoot: string): McpToolSnapshot {
    const snapshot: McpToolSnapshot = { tools: [], servers: [] };
    for (const entry of this.entries.values()) {
      if (entry.status !== "ready" || !entry.connection) continue;
      const tools = createMcpTools(
        entry.config,
        entry.connection,
        entry.catalog.signal,
        () =>
          this.entries.get(entry.config.id) === entry && entry.status === "ready" && !this.disposed,
        workspaceRoot,
      );
      if (!tools.length) continue;
      snapshot.tools.push(...tools);
      snapshot.servers.push({
        id: entry.config.id,
        name: entry.config.name,
        instructions: entry.connection.instructions,
        toolNames: tools.map((tool) => tool.name),
      });
    }
    return snapshot;
  }

  async close(): Promise<void> {
    this.disposed = true;
    for (const entry of this.entries.values()) this.retire(entry);
    this.entries.clear();
    await this.tail;
    await Promise.allSettled([...this.closing]);
  }

  private update(
    change: (configs: McpServerConfig[]) => McpServerConfig[],
    setupId?: string,
  ): Promise<void> {
    const operation = this.tail.then(async () => {
      if (this.disposed) throw new McpConfigError("mcp_manager_closed");
      if (this.failure) throw new McpConfigError(this.failure);
      const configs = change([...this.entries.values()].map((entry) => entry.config));
      await writeMcpConfigs(this.file, configs);
      if (!this.disposed) this.replace(configs, setupId);
    });
    this.tail = operation.catch(() => {});
    return operation;
  }

  private entry(config: McpServerConfig, setup = false): Entry {
    return {
      config,
      controller: new AbortController(),
      catalog: new AbortController(),
      status: config.enabled ? "queued" : "disabled",
      setup,
    };
  }

  private replace(configs: McpServerConfig[], setupId?: string): void {
    const next = new Map<string, Entry>();
    for (const config of configs) {
      const old = this.entries.get(config.id);
      if (
        old &&
        JSON.stringify({ ...old.config, name: "" }) === JSON.stringify({ ...config, name: "" })
      )
        old.config = config;
      next.set(
        config.id,
        old &&
          JSON.stringify(old.config) === JSON.stringify(config) &&
          (config.id !== setupId || old.status === "ready" || old.status === "disabled")
          ? old
          : this.entry(config, config.id === setupId),
      );
    }
    for (const [id, entry] of this.entries) if (next.get(id) !== entry) this.retire(entry);
    this.entries = next;
    this.pump();
  }

  private retire(entry: Entry): void {
    entry.controller.abort();
    entry.catalog.abort();
    if (entry.connection) {
      this.trackClose(entry.connection);
      entry.connection = undefined;
    }
  }

  private trackClose(connection: McpConnection): void {
    const task = connection
      .close()
      .catch(() => {})
      .finally(() => this.closing.delete(task));
    this.closing.add(task);
  }

  private pump(): void {
    if (this.disposed) return;
    for (const entry of this.entries.values()) {
      if (this.active >= 3) break;
      if (entry.status !== "queued" || entry.connection || entry.controller.signal.aborted)
        continue;
      if (this.started.has(entry)) continue;
      this.started.add(entry);
      entry.status = "connecting";
      this.active++;
      void this.connect(entry);
    }
  }

  private started = new WeakSet<Entry>();

  private current(entry: Entry): boolean {
    return (
      this.entries.get(entry.config.id) === entry &&
      !this.disposed &&
      !entry.controller.signal.aborted
    );
  }

  private changed(entry: Entry, event: "catalog" | "closed", error?: McpFailureCode): void {
    if (!this.current(entry)) return;
    if (event === "closed") {
      entry.status = "error";
      entry.error = error ?? "connection_closed";
      this.retire(entry);
      return;
    }
    entry.dirty = true;
    entry.catalog.abort();
    if (entry.status === "ready") void this.refresh(entry);
  }

  private async refresh(entry: Entry): Promise<void> {
    const connection = entry.connection;
    if (!connection || !this.current(entry)) return;
    entry.status = "refreshing";
    try {
      do {
        entry.dirty = false;
        const tools = await discoverMcp(entry.controller.signal, (signal) =>
          connection.refresh(signal),
        );
        if (!this.current(entry)) return;
        connection.tools = tools;
      } while (entry.dirty);
      entry.catalog = new AbortController();
      entry.status = "ready";
    } catch (error) {
      if (this.current(entry)) {
        entry.status = "error";
        const code = mcpFailureCode(error);
        entry.error = code === "connection_failed" ? "refresh_failed" : code;
        this.retire(entry);
      }
    }
  }

  private async connect(entry: Entry): Promise<void> {
    const setup = entry.setup && entry.config.transport === "stdio";
    try {
      const connection = await discoverMcp(
        entry.controller.signal,
        (signal) =>
          this.connector(
            entry.config,
            signal,
            (event, error) => this.changed(entry, event, error),
            setup ? MCP_SETUP_TIMEOUT_MS : undefined,
          ),
        (late) => this.trackClose(late),
        setup ? MCP_SETUP_TIMEOUT_MS : undefined,
      );
      if (this.current(entry)) {
        entry.connection = connection;
        entry.status = "ready";
        if (entry.dirty) void this.refresh(entry);
      } else this.trackClose(connection);
    } catch (error) {
      if (this.current(entry)) {
        entry.status = "error";
        entry.error = mcpFailureCode(error);
        this.retire(entry);
      }
    } finally {
      this.active--;
      this.pump();
    }
  }
}
