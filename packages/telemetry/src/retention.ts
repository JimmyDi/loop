import { readdir, readFile, rename, rm, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { acquireTraceLock } from "./storage";

export type TraceRetentionOptions = { maxAgeDays?: number; maxTotalBytes?: number };

const size = async (directory: string): Promise<number> => {
  let bytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) bytes += await size(path);
    else if (entry.isFile()) bytes += (await stat(path)).size;
  }
  return bytes;
};

const active = async (directory: string): Promise<boolean> => {
  try {
    const lock = JSON.parse(await readFile(join(directory, "writer.lock"), "utf8")) as {
      pid: number;
    };
    if (!Number.isSafeInteger(lock.pid) || lock.pid <= 0) return true;
    process.kill(lock.pid, 0);
    return true;
  } catch (error) {
    return !["ENOENT", "ESRCH"].includes((error as NodeJS.ErrnoException).code ?? "");
  }
};

/** Removes only inactive, recognizable trace directories, oldest first. */
export const pruneTraces = async (
  root: string,
  options: TraceRetentionOptions = {},
): Promise<void> => {
  const days = options.maxAgeDays ?? 30;
  const cap = options.maxTotalBytes ?? 1024 * 1024 * 1024;
  if (!Number.isFinite(days) || days <= 0 || !Number.isSafeInteger(cap) || cap < 1)
    throw new Error("Invalid trace retention limits");
  let workspaces;
  try {
    workspaces = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  const records: Array<{ path: string; bytes: number; updatedAt: number; active: boolean }> = [];
  for (const workspace of workspaces) {
    if (!workspace.isDirectory() || !/^[a-f0-9]{24}$/.test(workspace.name)) continue;
    const directory = join(root, workspace.name);
    for (const session of await readdir(directory, { withFileTypes: true })) {
      if (!session.isDirectory() || !/^[a-f0-9-]{36}$/.test(session.name)) continue;
      const path = join(directory, session.name);
      try {
        const manifest = join(path, "manifest.json");
        const data = JSON.parse(await readFile(manifest, "utf8")) as {
          format?: string;
          version?: number;
        };
        if (data.format !== "loop-trace" || data.version !== 1) continue;
        records.push({
          path,
          bytes: await size(path),
          updatedAt: (await stat(manifest)).mtimeMs,
          active: await active(path),
        });
      } catch {
        /* Unknown or concurrently removed directories are not retention candidates. */
      }
    }
  }
  let total = records.reduce((sum, record) => sum + record.bytes, 0);
  const cutoff = Date.now() - days * 86400000;
  for (const record of records.sort((a, b) => a.updatedAt - b.updatedAt)) {
    if (record.active || (record.updatedAt >= cutoff && total <= cap)) continue;
    let release: (() => Promise<void>) | undefined;
    const retired = join(root, "retired-" + randomUUID());
    try {
      release = await acquireTraceLock(record.path);
      if ((await stat(join(record.path, "manifest.json"))).mtimeMs !== record.updatedAt) continue;
      await rename(record.path, retired);
      await rm(retired, { recursive: true, force: true });
      total -= record.bytes;
    } catch {
      /* A new writer or cleanup failure leaves recording unaffected. */
    } finally {
      await release?.().catch(() => {});
    }
  }
};
