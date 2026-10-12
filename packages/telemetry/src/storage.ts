import { open, mkdir, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import type { TraceManifest } from "./types";
import type { SerializedTraceRecord } from "./serialize-record";

export const traceSegments = async (directory: string): Promise<string[]> => {
  try {
    return (await readdir(directory)).filter((name) => /^events-\d{6}\.jsonl$/.test(name)).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
};

export const writeManifest = async (directory: string, manifest: TraceManifest): Promise<void> => {
  const temporary = join(directory, "manifest-" + randomUUID() + ".tmp");
  try {
    const file = await open(temporary, "wx", 0o600);
    try {
      await file.writeFile(JSON.stringify(manifest) + "\n");
    } finally {
      await file.close();
    }
    await rename(temporary, join(directory, "manifest.json"));
  } finally {
    await rm(temporary, { force: true });
  }
};

/** One owner per session; a dead process's lock can be reclaimed without editing its log. */
export const acquireTraceLock = async (directory: string): Promise<() => Promise<void>> => {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, "writer.lock");
  const token = randomUUID();
  let file: FileHandle;
  try {
    file = await open(path, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const guardPath = join(directory, "reclaim.lock");
    const guard = await open(guardPath, "wx", 0o600);
    try {
      const lock = JSON.parse(await readFile(path, "utf8")) as { pid: number };
      if (!Number.isSafeInteger(lock.pid) || lock.pid <= 0) throw new Error("Invalid trace lock");
      try {
        process.kill(lock.pid, 0);
        throw new Error("Trace already has a writer");
      } catch (failure) {
        if ((failure as NodeJS.ErrnoException).code !== "ESRCH") throw failure;
      }
      await rm(path);
      file = await open(path, "wx", 0o600);
    } finally {
      await guard.close();
      await rm(guardPath, { force: true });
    }
  }
  try {
    await file.writeFile(JSON.stringify({ pid: process.pid, token }));
  } catch (error) {
    await rm(path, { force: true });
    throw error;
  } finally {
    await file.close();
  }
  return async () => {
    const lock = JSON.parse(await readFile(path, "utf8")) as { token?: string };
    if (lock.token === token) await rm(path);
  };
};

export class TraceWriter {
  private file?: FileHandle;
  private segment = 0;
  private bytes = 0;
  totalBytes = 0;

  constructor(
    readonly directory: string,
    private readonly segmentBytes: number,
  ) {}

  async initialize(): Promise<void> {
    const segments = await traceSegments(this.directory);
    this.segment = segments.length ? Number(segments.at(-1)!.slice(7, 13)) : 1;
    for (const name of segments) this.totalBytes += (await stat(join(this.directory, name))).size;
    this.bytes = segments.length ? (await stat(join(this.directory, segments.at(-1)!))).size : 0;
    await mkdir(join(this.directory, "payloads"), { recursive: true, mode: 0o700 });
    for (const name of await readdir(join(this.directory, "payloads")))
      this.totalBytes += (await stat(join(this.directory, "payloads", name))).size;
  }

  async appendBatch(
    records: readonly SerializedTraceRecord[],
    onWritten: (count: number, seq: number) => void,
  ): Promise<void> {
    let lines: string[] = [];
    let pendingBytes = 0;
    let lastSeq = -1;
    const flush = async () => {
      if (!lines.length) return;
      if (this.segment > 999999) throw new Error("Trace segment limit reached");
      this.file ??= await open(
        join(this.directory, `events-${String(this.segment).padStart(6, "0")}.jsonl`),
        "a",
        0o600,
      );
      await this.file.writeFile(lines.join(""));
      this.bytes += pendingBytes;
      this.totalBytes += pendingBytes;
      onWritten(lines.length, lastSeq);
      lines = [];
      pendingBytes = 0;
    };

    for (const record of records) {
      if (record.payload) {
        await flush();
        const file = await open(join(this.directory, record.payload.reference), "wx", 0o600);
        try {
          await file.writeFile(record.payload.content);
        } finally {
          await file.close();
        }
        this.totalBytes += record.payload.bytes;
      }
      if (
        this.bytes + pendingBytes > 0 &&
        this.bytes + pendingBytes + record.lineBytes > this.segmentBytes
      ) {
        await flush();
        await this.file?.close();
        this.file = undefined;
        this.segment++;
        this.bytes = 0;
      }
      lines.push(record.line);
      pendingBytes += record.lineBytes;
      lastSeq = record.seq;
    }
    await flush();
  }

  async close(): Promise<void> {
    await this.file?.close();
    this.file = undefined;
  }
}
