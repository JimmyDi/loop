import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { ScheduleService } from "./service";
import { ScheduleStore } from "./store";
import type { ScheduleHost, ScheduleInput, ScheduleRun } from "./types";

const input = (): ScheduleInput => ({
  name: "Demo",
  prompt: "Summarize the project",
  projectId: "demo",
  trigger: { kind: "interval", anchorAt: Date.now() + 60000, everyMs: 60000 },
  permission: "read-only",
  missed: "run-once",
});

test("timer coalesces overdue periods, records missed one-shots and wakes at the next due time", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-schedule-"));
  const executions: ScheduleRun[] = [];
  const host: ScheduleHost = {
    available: () => true,
    execute: async (run) => {
      executions.push(run);
      return "completed";
    },
  };
  const scheduler = new ScheduleService(dir, host);
  try {
    await scheduler.start();
    const start = Date.now();
    const anchorAt = start + 1800000;
    const periodic = await scheduler.put({
      ...input(),
      trigger: { kind: "interval", anchorAt, everyMs: 90 * 60000 },
    });
    const once = await scheduler.put({
      ...input(),
      trigger: { kind: "once", at: anchorAt },
      missed: "ask",
    });
    const clock = vi.spyOn(Date, "now").mockReturnValue(anchorAt + 2 * 90 * 60000 + 61000);
    await scheduler.tick();
    await vi.waitFor(() => expect(scheduler.busy).toBe(false));
    await scheduler.tick();
    await vi.waitFor(() => expect(scheduler.busy).toBe(false));
    expect(executions).toHaveLength(1);
    expect(executions[0]).toMatchObject({
      scheduleId: periodic.id,
      scheduledFor: anchorAt + 2 * 90 * 60000,
    });
    expect(scheduler.list().find((plan) => plan.id === once.id)?.status).toBe("missed");
    expect(await scheduler.history(once.id)).toMatchObject([{ status: "skipped" }]);
    await scheduler.change(once.id, "delete");
    expect((await scheduler.history()).map((run) => run.scheduleId)).toEqual([
      periodic.id,
      once.id,
    ]);
    clock.mockRestore();
    const due = await scheduler.put({
      ...input(),
      trigger: { kind: "once", at: Date.now() + 100 },
    });
    await vi.waitFor(() => expect(executions.some((run) => run.scheduleId === due.id)).toBe(true));
  } finally {
    vi.restoreAllMocks();
    await scheduler.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("only the owner writes, manual retries deduplicate, cancellation survives restart", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-schedule-"));
  const entered = Promise.withResolvers<void>();
  const execute: ScheduleHost["execute"] = vi.fn(async (_run, attach, signal) => {
    await attach("demo-session");
    entered.resolve();
    await new Promise<void>((resolve) =>
      signal.addEventListener("abort", () => resolve(), { once: true }),
    );
    return "cancelled" as const;
  });
  const host = { available: () => true, execute };
  const first = new ScheduleService(dir, host);
  const second = new ScheduleService(dir, host);
  try {
    await first.start();
    await second.start();
    expect(second.owner).toBe(false);
    await expect(second.put(input())).rejects.toThrow();
    const p = await first.put(input());
    const key = crypto.randomUUID();
    const run = await first.change(p.id, "run", key);
    expect(run?.status).toBe("queued");
    await first.tick();
    await entered.promise;
    expect(first.list()[0]?.activeRun?.status).toBe("running");
    expect((await first.change(p.id, "run", key))?.id).toBe(run?.id);
    await first.change(p.id, "pause");
    await first.close();
    await second.tick();
    expect(second.list()[0]?.status).toBe("paused");
    expect(await second.history(p.id)).toMatchObject([
      { sessionId: "demo-session", status: "cancelled" },
    ]);
    expect(execute).toHaveBeenCalledTimes(1);
  } finally {
    await first.close();
    await second.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test("recover queued intent without a run file, reconcile running work without replay", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-schedule-"));
  const execute = vi.fn(async () => "completed" as const);
  const setup = new ScheduleService(dir, { available: () => false, execute });
  const next = new ScheduleService(dir, { available: () => true, execute });
  try {
    await setup.start();
    const a = await setup.put(input());
    const b = await setup.put(input());
    await setup.close();
    const store = new ScheduleStore(join(dir, "schedules"));
    for (const plan of [a, b]) {
      const run: ScheduleRun = {
        id: "at-100",
        scheduleId: plan.id,
        input: input(),
        revision: 1,
        source: "timer",
        scheduledFor: 100,
        status: "queued",
      };
      await store.save({ ...plan, activeRun: run });
      if (plan === b)
        await store.saveRun({ ...run, sessionId: "interrupted-session", status: "running" });
    }
    const index = join(dir, "schedules", "runs.jsonl");
    await writeFile(index, "partial JSON line");
    await next.start();
    await next.tick();
    await vi.waitFor(async () => expect((await next.history(a.id))[0]?.status).toBe("completed"));
    expect((await next.history(b.id))[0]?.status).toBe("interrupted");
    const allRuns = await next.history();
    expect(allRuns).toHaveLength(2);
    expect(allRuns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ scheduleId: a.id, status: "completed" }),
        expect.objectContaining({ scheduleId: b.id, status: "interrupted" }),
      ]),
    );
    await vi.waitFor(async () => {
      const lines = (await readFile(index, "utf8")).trim().split("\n");
      expect(lines.map((line) => JSON.parse(line))).toEqual(
        expect.arrayContaining(
          allRuns.map(({ input, ...run }) => ({
            ...run,
            input: { name: input.name, projectId: input.projectId },
          })),
        ),
      );
      expect(lines).toHaveLength(2);
    });
    await next.change(b.id, "delete");
    expect(await next.history()).toEqual(allRuns);
    expect(execute).toHaveBeenCalledTimes(1);
  } finally {
    await setup.close();
    await next.close();
    await rm(dir, { recursive: true, force: true });
  }
});
