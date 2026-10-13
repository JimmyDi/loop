import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test } from "vitest";

import { TraceRecorder } from "./recorder";
import { readTrace } from "./reader";

test("a torn tail returns the valid prefix and is never silently appended to", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-trace-tail-"));
  try {
    const trace = await TraceRecorder.open(directory, "synthetic-session");
    trace.record({ type: "run.started", runId: "run", operationId: "run" });
    await trace.close();
    await writeFile(join(directory, "events-000001.jsonl"), '{"partial":', { flag: "a" });
    const page = await readTrace(directory);
    expect(page.events).toHaveLength(1);
    expect(page.warnings).toContain("Incomplete tail in events-000001.jsonl");
    const next = await TraceRecorder.open(directory, "synthetic-session");
    expect(next.status.enabled).toBe(false);
    await next.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("middle corruption stops at the valid prefix and query validation rejects invalid cursors", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-trace-corrupt-"));
  try {
    const trace = await TraceRecorder.open(directory, "synthetic-session");
    trace.record({ type: "first", runId: "a" });
    await trace.close();
    await writeFile(join(directory, "events-000001.jsonl"), "broken\n{}\n", { flag: "a" });
    const page = await readTrace(directory);
    expect(page.events.map((event) => event.type)).toEqual(["first"]);
    expect(page.warnings).toEqual(["Corrupt trace at events-000001.jsonl:2"]);
    await expect(readTrace(directory, { afterSeq: -2 })).rejects.toThrow("Invalid trace cursor");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("hydrated pages respect the byte limit and preserve a resumable cursor", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-trace-page-"));
  const trace = await TraceRecorder.open(directory, "synthetic-session");
  try {
    for (let index = 0; index < 3; index++) {
      trace.record({ type: "large", data: { text: "x".repeat(6 * 1024 * 1024) } });
      await trace.flush();
    }
    await trace.close();
    const page = await readTrace(directory, { limit: 1000 });
    expect(page.events.map((event) => event.seq)).toEqual([0, 1]);
    expect(page.hasMore).toBe(true);
    expect(page.nextSeq).toBe(1);
    const next = await readTrace(directory, { afterSeq: page.nextSeq });
    expect(next.events.map((event) => event.seq)).toEqual([2]);
    expect(next.hasMore).toBe(false);
  } finally {
    await trace.close();
    await rm(directory, { recursive: true, force: true });
  }
});
