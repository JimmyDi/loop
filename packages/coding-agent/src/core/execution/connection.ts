import {
  chmodSync,
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { credentialCommand } from "./credential-store";

import { getAgentDir } from "../../config";
import { validateExecution } from "./types";
import type { ExecutionEnvironment } from "./types";

type Connection = { url: string; store: "keychain" | "file"; account: string; token?: string };
const location = () => join(getAgentDir(), "sandbox-connection.json");

export const sandboxUrl = (url: string): string => {
  const parsed = validateExecution({ type: "sandbox", url, tokenEnv: "LOOP_SANDBOX_TOKEN" });
  if (parsed.type !== "sandbox" || !("url" in parsed)) throw new Error("Invalid sandbox URL");
  const target = new URL(parsed.url);
  if (target.pathname === "/") target.pathname = "/mcp/";
  if (target.pathname === "/mcp") target.pathname += "/";
  if (
    target.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)
  )
    throw new Error("Remote sandbox connections require HTTPS");
  return target.href;
};

const readConnection = (): Connection | undefined => {
  const path = location();
  if (!existsSync(path)) return undefined;
  if (
    lstatSync(path).isSymbolicLink() ||
    (process.platform !== "win32" && lstatSync(path).mode & 0o077)
  )
    throw new Error("Sandbox connection file must be private (mode 0600)");
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as Connection;
    if (
      !["keychain", "file"].includes(value.store) ||
      !/^[a-f0-9-]{36}$/.test(value.account) ||
      (value.store === "file" && (typeof value.token !== "string" || !value.token))
    )
      throw new Error();
    return { ...value, url: sandboxUrl(value.url) };
  } catch {
    throw new Error("Invalid saved sandbox connection");
  }
};

export const saveSandboxConnection = (url: string, token: string, file = false): void => {
  if (!token || /[\r\n\0]/.test(token)) throw new Error("Invalid sandbox token");
  const previous = readConnection();
  const normalized = sandboxUrl(url);
  const connection: Connection = {
    url: normalized,
    account:
      previous?.store === "keychain" && !file && previous.url === normalized
        ? previous.account
        : randomUUID(),
    store: file ? "file" : "keychain",
  };
  if (file) connection.token = token;
  else {
    credentialCommand("write", connection.account, token);
    if (credentialCommand("read", connection.account) !== token)
      throw new Error("Credential store verification failed; connection was not saved");
  }
  mkdirSync(getAgentDir(), { recursive: true, mode: 0o700 });
  const path = location();
  if (existsSync(path) && lstatSync(path).isSymbolicLink())
    throw new Error("Refusing symlink connection file");
  const temporary = path + "." + randomUUID();
  const descriptor = openSync(temporary, "wx", 0o600);
  try {
    try {
      writeFileSync(descriptor, JSON.stringify(connection) + "\n");
    } finally {
      closeSync(descriptor);
    }
    renameSync(temporary, path);
    chmodSync(path, 0o600);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
};

export const sandboxConfiguration = ():
  | Extract<ExecutionEnvironment, { url: string }>
  | undefined => {
  const url = process.env.LOOP_SANDBOX_URL;
  if (url) {
    const normalized = sandboxUrl(url);
    if (process.env.LOOP_SANDBOX_TOKEN || readConnection()?.url === normalized)
      return { type: "sandbox", url: normalized, tokenEnv: "LOOP_SANDBOX_TOKEN" };
    return undefined;
  }
  const saved = readConnection();
  return saved ? { type: "sandbox", url: saved.url, tokenEnv: "LOOP_SANDBOX_TOKEN" } : undefined;
};

export const sandboxToken = (config: Extract<ExecutionEnvironment, { url: string }>): string => {
  const environment = process.env[config.tokenEnv];
  if (environment) return environment;
  // Custom SDK credential variables never silently pick up the default connection.
  const saved = config.tokenEnv === "LOOP_SANDBOX_TOKEN" ? readConnection() : undefined;
  if (!saved || saved.url !== sandboxUrl(config.url))
    throw new Error(
      "Sandbox credential is missing; run loop sandbox connect or set the configured token variable",
    );
  const token = saved.store === "file" ? saved.token : credentialCommand("read", saved.account);
  if (!token) throw new Error("Saved sandbox credential is unavailable");
  return token;
};
