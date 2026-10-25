import { basename, dirname, join } from "node:path";
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { stageTraceDeletion } from "@loop/telemetry";

import { atomicWrite } from "../utils/atomic-write";
import { SessionManager } from "./session-manager";

/** Archive membership is separate from history so live history saves cannot overwrite it. */
export class SessionArchive {
  private writes: Promise<unknown> = Promise.resolve();
  private readonly file: string;

  constructor(
    private readonly sessionDir: string,
    private readonly traceDir = basename(dirname(sessionDir)) === "sessions" &&
    /^[a-f0-9]{24}$/.test(basename(sessionDir))
      ? join(dirname(dirname(sessionDir)), "traces", basename(sessionDir))
      : undefined,
  ) {
    this.file = join(sessionDir, "archive.json");
  }

  delete(cwd: string, ids: string[], { archivedOnly = true } = {}): Promise<void> {
    const selected = [...new Set(ids)];
    const operation = this.writes.then(async () => {
      const entries = await this.read();
      const records = await SessionManager.list(cwd, this.sessionDir);
      const targets = selected.map((id) => {
        const record = records.find((item) => item.id === id);
        if (!record) throw new Error("Session not found in project");
        if (archivedOnly && !entries.has(id)) throw new Error("Session is not archived");
        return record;
      });
      if (!targets.length) return;
      const staging = join(this.sessionDir, ".delete-" + crypto.randomUUID());
      const moved: { original: string; staged: string }[] = [];
      const restoreTraces: Array<() => Promise<void>> = [];
      await mkdir(staging, { mode: 0o700 });
      try {
        for (const record of targets) {
          if (!/^[a-f0-9-]{36}$/.test(record.id)) throw new Error("Invalid session ID");
          if (this.traceDir) {
            const restore = await stageTraceDeletion(
              join(this.traceDir, record.id),
              join(staging, record.id + ".traces"),
            );
            if (restore) restoreTraces.push(restore);
          }
          const original =
            basename(record.path) === "meta.json" ? dirname(record.path) : record.path;
          const staged = join(staging, record.id);
          await rename(original, staged);
          moved.push({ original, staged });
          const legacy = join(this.sessionDir, record.id + ".jsonl");
          if (original !== legacy && existsSync(legacy)) {
            const backup = join(staging, record.id + ".jsonl");
            await rename(legacy, backup);
            moved.push({ original: legacy, staged: backup });
          }
        }
        for (const id of selected) entries.delete(id);
        await atomicWrite(this.file, JSON.stringify([...entries]) + "\n");
      } catch (error) {
        const rollback = await Promise.allSettled([
          ...moved.reverse().map((file) => rename(file.staged, file.original)),
          ...restoreTraces.reverse().map((restore) => restore()),
        ]);
        const failures = rollback.flatMap((result) =>
          result.status === "rejected" ? [result.reason] : [],
        );
        if (failures.length)
          throw new AggregateError([error, ...failures], "Session deletion rollback failed");
        await rm(staging, { recursive: true, force: true });
        throw error;
      }
      await rm(staging, { recursive: true, force: true });
    });
    this.writes = operation.catch(() => {});
    return operation;
  }

  async list(): Promise<Set<string>> {
    await this.writes;
    return this.read();
  }

  set(ids: string[], archived: boolean): Promise<void> {
    const selected = [...ids];
    const operation = this.writes.then(async () => {
      if (selected.some((id) => !/^[a-f0-9-]{36}$/.test(id)))
        throw new Error("Invalid archived session ID");

      const entries = await this.read();
      for (const id of selected) {
        if (archived) entries.add(id);
        else entries.delete(id);
      }
      await atomicWrite(this.file, JSON.stringify([...entries]) + "\n");
    });
    this.writes = operation.catch(() => {});
    return operation;
  }

  private async read(): Promise<Set<string>> {
    if (!(await existsSync(this.file))) return new Set();
    const value: unknown = await readFile(this.file, "utf8").then(JSON.parse);
    if (
      !Array.isArray(value) ||
      value.some((id) => typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id))
    )
      throw new Error("Invalid session archive");
    return new Set(value);
  }
}
