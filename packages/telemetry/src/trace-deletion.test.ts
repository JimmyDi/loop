import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test } from "vitest";

import { TraceRecorder } from "./recorder";
import { stageTraceDeletion } from "./trace-deletion";

test("trace staging rejects active writers, restores closed traces and skips missing directories", async () => {
  const root = await mkdtemp(join(tmpdir(), "loop-trace-delete-"));
  const directory = join(root, "trace");
  const destination = join(root, "staged");
  const recorder = await TraceRecorder.open(directory, "synthetic-session");
  try {
    recorder.record({ type: "synthetic.event" });
    await expect(stageTraceDeletion(directory, destination)).rejects.toThrow(
      "Trace already has a writer",
    );
    expect(existsSync(destination)).toBe(false);
    await recorder.close();
    const original = await readFile(join(directory, "events-000001.jsonl"), "utf8");
    const restore = await stageTraceDeletion(directory, destination);
    expect(existsSync(directory)).toBe(false);
    expect(existsSync(join(destination, "writer.lock"))).toBe(true);
    await restore!();
    expect(await readFile(join(directory, "events-000001.jsonl"), "utf8")).toBe(original);
    expect(existsSync(join(directory, "writer.lock"))).toBe(false);
    const missing = join(root, "missing");
    expect(await stageTraceDeletion(missing, destination)).toBeUndefined();
    expect(existsSync(missing)).toBe(false);
    await expect(stageTraceDeletion(directory, join(root, "absent", "staged"))).rejects.toThrow();
    expect(existsSync(join(directory, "writer.lock"))).toBe(false);
  } finally {
    await recorder.close();
    await rm(root, { recursive: true, force: true });
  }
});
