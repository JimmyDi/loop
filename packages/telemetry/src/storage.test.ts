import { mkdtemp, open, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test, vi } from "vitest";

import { TraceWriter } from "./storage";
import type { SerializedTraceRecord } from "./serialize-record";

test("batches reduce file writes while preserving record boundaries and rotation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-trace-batch-"));
  const probe = await open(join(directory, "probe"), "w");
  const write = vi.spyOn(Object.getPrototypeOf(probe), "writeFile");
  const writer = new TraceWriter(directory, 60);
  try {
    await writer.initialize();
    const records: SerializedTraceRecord[] = Array.from({ length: 12 }, (_, seq) => {
      const line = JSON.stringify({ seq }) + "\n";
      return { seq, line, lineBytes: Buffer.byteLength(line) };
    });
    const written = vi.fn();
    await writer.appendBatch(records, written);
    await writer.close();
    expect(write).toHaveBeenCalledTimes(3);
    expect(written.mock.calls).toEqual([
      [6, 5],
      [5, 10],
      [1, 11],
    ]);
    const names = (await readdir(directory)).filter((name) => name.startsWith("events-")).sort();
    const text = (
      await Promise.all(names.map((name) => readFile(join(directory, name), "utf8")))
    ).join("");
    expect(text).toBe(records.map((record) => record.line).join(""));
    expect(writer.totalBytes).toBe(Buffer.byteLength(text));
  } finally {
    write.mockRestore();
    await writer.close();
    await probe.close();
    await rm(directory, { recursive: true, force: true });
  }
});
