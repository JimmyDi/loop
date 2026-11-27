import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

import { RunHistoryIndex } from "./run-history-index";
import type { ScheduleRun } from "./types";

const run = (id: string, scheduledFor: number): ScheduleRun => ({
  id,
  scheduleId: "task",
  scheduledFor,
  revision: 1,
  source: "manual",
  status: "queued",
  input: {
    projectId: "project",
    name: "Example",
    prompt: "Example instructions",
    trigger: { kind: "once", at: 100 },
    missed: "skip",
    permission: "read-only",
  },
});

test("coalesces updates on disk and pages across tied timestamps and new runs", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-run-index-"));
  const path = join(dir, "runs.jsonl");
  const index = new RunHistoryIndex(path);
  try {
    const first = run("a", 100);
    await index.rebuild([first, run("b", 100), run("c", 50)]);
    const initial = await readFile(path, "utf8");
    const cursor = index.page(1)?.nextCursor;
    expect(cursor?.id).toBe("a");
    index.update({ ...first, status: "running" });
    index.update({ ...first, status: "completed", sessionId: "chat" });
    index.update(run("new", 200));
    expect(index.page(1, cursor ?? undefined)?.runs.map((row) => row.id)).toEqual(["b"]);
    expect(index.history()?.find((row) => row.id === "a")?.status).toBe("completed");
    expect(await readFile(path, "utf8")).toBe(initial);
    await index.flush();
    const records = (await readFile(path, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(records).toHaveLength(4);
    expect(records.find((row) => row.id === "a")).toMatchObject({
      status: "completed",
      sessionId: "chat",
    });
    expect(records[0]?.input).toEqual({ name: "Example", projectId: "project" });
  } finally {
    await index.flush();
    await rm(dir, { recursive: true, force: true });
  }
});
