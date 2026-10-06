import { dirname } from "node:path";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";

import { McpConfigError } from "./types";
import type { McpServerConfig, McpValue } from "./types";
import { validateMcpConfig } from "./validate-config";

export const readMcpConfigs = async (file: string): Promise<McpServerConfig[]> => {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new McpConfigError("mcp_config_unreadable");
  }
  try {
    const data = JSON.parse(text);
    if (data.version !== 1 || !Array.isArray(data.servers)) throw new Error();
    const configs = data.servers.map(validateMcpConfig);
    if (new Set(configs.map((entry: McpServerConfig) => entry.id)).size !== configs.length)
      throw new Error();
    return configs;
  } catch {
    throw new McpConfigError("mcp_config_invalid");
  }
};

export const writeMcpConfigs = async (file: string, servers: McpServerConfig[]): Promise<void> => {
  const temporary = file + "." + crypto.randomUUID() + ".tmp";
  try {
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(JSON.stringify({ version: 1, servers }, null, 2) + "\n");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, file);
  } catch {
    throw new McpConfigError("mcp_config_write_failed");
  } finally {
    await unlink(temporary).catch(() => {});
  }
};

export const mergeMcpSecrets = (
  next: McpServerConfig,
  previous?: McpServerConfig,
): McpServerConfig => {
  const merge = (rows: McpValue[], saved: McpValue[] = [], caseSensitive = true) =>
    rows.map(({ key, value, saved: retain }) => {
      const old = saved.find((row) =>
        caseSensitive ? row.key === key : row.key.toLowerCase() === key.toLowerCase(),
      );
      if (retain && !value && !old) throw new McpConfigError("mcp_secret_required");
      return { key, value: retain && !value ? old!.value : value };
    });
  if (next.transport === "stdio") {
    const same =
      previous?.transport === "stdio" &&
      previous.command === next.command &&
      previous.cwd === next.cwd &&
      JSON.stringify(previous.args) === JSON.stringify(next.args);
    return { ...next, env: merge(next.env, same ? previous.env : []) };
  }
  const same = previous?.transport === "http" && previous.url === next.url;
  return { ...next, headers: merge(next.headers, same ? previous.headers : [], false) };
};

export const redactMcpConfig = (value: McpServerConfig): McpServerConfig => {
  const redact = (rows: McpValue[]) => rows.map(({ key }) => ({ key, value: "", saved: true }));
  return value.transport === "stdio"
    ? { ...structuredClone(value), env: redact(value.env) }
    : { ...structuredClone(value), headers: redact(value.headers) };
};
