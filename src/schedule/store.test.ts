import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ScheduleStore } from "./store";

test("schedule lifecycle persists and toggles tasks", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-test-"));
  try {
    const store = new ScheduleStore(dir);
    const task = await store.create("example", "0 9 * * *", "hello");
    expect((await store.list()).length).toBe(1);
    expect((await store.setEnabled(task.id, false))?.enabled).toBe(false);
    expect(await store.remove(task.id)).toBe(true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
