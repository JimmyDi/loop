import { isAbsolute } from "node:path";

import { McpConfigError } from "./types";
import type { McpServerConfig, McpValue } from "./types";

const invalid = (): never => {
  throw new McpConfigError("invalid_mcp_config");
};

const string = (value: unknown, required = false): string => {
  if (typeof value !== "string" || value.includes("\0") || (required && !value.trim()))
    return invalid();
  return value;
};

const strings = (value: unknown): string[] => {
  if (!Array.isArray(value) || value.length > 200) return invalid();
  return value.map((item) => string(item));
};

const envName = (value: string): string => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) return invalid();
  return value;
};

const pairs = (value: unknown, environment = false): McpValue[] => {
  if (!Array.isArray(value) || value.length > 200) return invalid();
  const rows = value.map((row) => {
    if (!row || typeof row !== "object") return invalid();
    const key = string(row.key, true).trim();
    if (environment) envName(key);
    else if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(key)) return invalid();
    const entry = string(row.value);
    if (!environment && /[\r\n]/.test(entry)) return invalid();
    if (row.saved !== undefined && typeof row.saved !== "boolean") return invalid();
    return { key, value: entry, ...(row.saved ? { saved: true } : {}) };
  });
  const names = rows.map((row) => (environment ? row.key : row.key.toLowerCase()));
  if (new Set(names).size !== names.length) return invalid();
  return rows;
};

export const validateMcpConfig = (input: unknown): McpServerConfig => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return invalid();
  const value = input as Record<string, unknown>;
  const id = string(value.id, true);
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) return invalid();
  const name = string(value.name, true).trim();
  if (name.length > 100 || typeof value.enabled !== "boolean") return invalid();
  const common = { id, name, enabled: value.enabled };
  if (value.transport === "stdio") {
    const cwd = string(value.cwd);
    if (cwd && !isAbsolute(cwd)) return invalid();
    const command = string(value.command, true).trim();
    const env = pairs(value.env, true);
    const envVars = strings(value.envVars).map(envName);
    if (new Set(envVars).size !== envVars.length) return invalid();
    return { ...common, transport: "stdio", command, args: strings(value.args), env, envVars, cwd };
  }
  if (value.transport === "http") {
    const url = string(value.url, true).trim();
    try {
      const parsed = new URL(url);
      if (
        !["https:", "http:"].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password ||
        parsed.hash
      )
        return invalid();
    } catch {
      return invalid();
    }
    const bearerTokenEnv = string(value.bearerTokenEnv).trim();
    if (bearerTokenEnv) envName(bearerTokenEnv);
    const headers = pairs(value.headers);
    const envHeaders = pairs(value.envHeaders).map((row) => ({
      key: row.key,
      value: envName(row.value),
    }));
    const keys = [...headers, ...envHeaders].map((row) => row.key.toLowerCase());
    if (new Set(keys).size !== keys.length || (bearerTokenEnv && keys.includes("authorization")))
      return invalid();
    return { ...common, transport: "http", url, bearerTokenEnv, headers, envHeaders };
  }
  return invalid();
};
