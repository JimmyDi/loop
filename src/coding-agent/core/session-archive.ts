import { join } from "node:path";
import { mkdir, rename, rm } from "node:fs/promises";

import { atomicWrite } from "../utils/atomic-write";
import { SessionManager } from "./session-manager";

/** Archive membership is separate from history so live history saves cannot overwrite it. */
export class SessionArchive {
  private writes: Promise<unknown> = Promise.resolve();
  private readonly file: string;

  constructor(private readonly sessionDir: string) {
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
      await mkdir(staging, { mode: 0o700 });
      try {
        for (const record of targets) {
          const staged = join(staging, record.id + ".jsonl");
          await rename(record.path, staged);
          moved.push({ original: record.path, staged });
        }
        for (const id of selected) entries.delete(id);
        await atomicWrite(this.file, JSON.stringify([...entries]) + "\n");
      } catch (error) {
        for (const file of moved.reverse()) await rename(file.staged, file.original);
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
    if (!(await Bun.file(this.file).exists())) return new Set();
    const value: unknown = await Bun.file(this.file).json();
    if (
      !Array.isArray(value) ||
      value.some((id) => typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id))
    )
      throw new Error("Invalid session archive");
    return new Set(value);
  }
}
