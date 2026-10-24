import { randomUUID } from "node:crypto";

import { runCli } from "./cli-process";
import { RemoteAccessError } from "./errors";
import { validTunnelId } from "./tunnel-store";
import type { TunnelRecord, TunnelStore } from "./tunnel-store";

const headers = ["--host-header", "unchanged", "--origin-header", "unchanged"];

export const prepareTunnel = async (
  file: string,
  store: TunnelStore,
  record: TunnelRecord,
  signal: AbortSignal,
): Promise<TunnelRecord> => {
  signal.throwIfAborted();
  const run = (args: string[]) => runCli(file, args, signal);
  if (record.configured) {
    const result = JSON.parse(await run(["port", "list", record.tunnelId, "--json"]));
    if (
      !Array.isArray(result.ports) ||
      result.ports.length !== 1 ||
      result.ports[0]?.portNumber !== record.port ||
      result.ports[0]?.protocol !== "http"
    )
      throw new RemoteAccessError("tunnel_failed");
    return record;
  }
  let output: string;
  if (record.tunnelId.includes(".")) {
    output = await run(["show", record.tunnelId, "--json"]);
  } else {
    try {
      output = await run(["create", record.tunnelId, "--expiration", "30d", ...headers, "--json"]);
    } catch {
      signal.throwIfAborted();
      // A previous attempt may have created the saved name before it was interrupted.
      output = await run(["show", record.tunnelId, "--json"]);
    }
  }
  signal.throwIfAborted();
  const id: unknown = JSON.parse(output).tunnel?.tunnelId;
  if (!validTunnelId(id) || !id.includes(".")) throw new RemoteAccessError("tunnel_failed");
  if (record.tunnelId.includes(".") && record.tunnelId !== id)
    throw new RemoteAccessError("tunnel_failed");
  record = { ...record, tunnelId: id };
  await store.save(record);
  signal.throwIfAborted();
  const result = JSON.parse(await run(["port", "list", id, "--json"]));
  const ports: unknown = result.ports ?? (typeof result.warning === "string" ? [] : undefined);
  if (!Array.isArray(ports) || ports.length > 1) throw new RemoteAccessError("tunnel_failed");
  if (ports.length === 0) {
    await run([
      "port",
      "create",
      id,
      "--port-number",
      String(record.port),
      "--protocol",
      "http",
      ...headers,
      "--json",
    ]);
  } else {
    if (ports[0]?.portNumber !== record.port || ports[0]?.protocol !== "http")
      throw new RemoteAccessError("tunnel_failed");
    await run(["port", "update", id, "--port-number", String(record.port), ...headers, "--json"]);
  }
  signal.throwIfAborted();
  record = { ...record, configured: true };
  await store.save(record);
  return record;
};

export const newTunnelRecord = (port: number): TunnelRecord => ({
  tunnelId: "loop-" + randomUUID().replaceAll("-", ""),
  port,
  configured: false,
});
