import { mkdtemp, rm } from "node:fs/promises";
import type { ListenOptions, ServerOpts, Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as waitForIO } from "node:timers/promises";
import { ScheduleService } from "@loop/coding-agent";
import { expect, test, vi } from "vitest";
import type { Frequency } from "./schedule-form-trigger";
import { repeatDefaults, formTrigger, localDateTime } from "./schedule-form-trigger";

vi.mock(import("node:net"), async (importOriginal) => {
  const net = await importOriginal();
  type ConnectionListener = (socket: Socket) => void;
  const createServer: typeof net.createServer = (
    options?: ServerOpts | ConnectionListener,
    listener?: ConnectionListener,
  ) => {
    const server =
      typeof options === "function"
        ? net.createServer(options)
        : net.createServer(options, listener);
    const listen = server.listen.bind(server);
    // These cases verify timer dispatch. Let the OS choose an available port for the lock.
    vi.spyOn(server, "listen").mockImplementation((options: unknown, callback?: () => void) =>
      listen({ ...(options as ListenOptions), port: 0 }, callback),
    );
    return server;
  };
  return { ...net, createServer };
});

test("round trips daily wall time and timezone without changing other cron schedules", () => {
  const trigger = formTrigger("daily", (key) => (key === "time" ? "09:05" : "Asia/Shanghai"));
  expect(trigger).toEqual({ kind: "cron", expression: "5 9 * * *", timezone: "Asia/Shanghai" });
  expect(repeatDefaults(trigger).time).toBe("09:05");
  expect(repeatDefaults({ kind: "cron", expression: "5 9 * * 1-5", timezone: "UTC" }).kind).toBe(
    "weekdays",
  );
  const interval = { kind: "interval", everyMs: 60000, anchorAt: 1234 } as const;
  expect(formTrigger("interval", () => "1", interval)).toEqual(interval);
});

test("saves fractional hours and retains the interval anchor on edit", () => {
  const interval = {
    kind: "interval",
    everyMs: 59_940_000,
    anchorAt: 1234,
    unit: "hours",
  } as const;
  expect(
    formTrigger("interval", (key) => (key === "amount" ? "16.65" : "hours"), interval),
  ).toEqual(interval);
});

const fields = (values: Record<string, string>) => (name: string) => values[name] ?? "";

test.each([
  ["weekdays", "1-5"],
  ["weekly", "0"],
] as const)("round trips the %s preset at midnight", (kind, days) => {
  const trigger = formTrigger(
    kind,
    fields({ time: "00:07", timezone: "Asia/Shanghai", weekday: "0" }),
  );
  expect(trigger).toEqual({
    kind: "cron",
    expression: "7 0 * * " + days,
    timezone: "Asia/Shanghai",
  });
  expect(repeatDefaults(trigger)).toMatchObject({ kind, time: "00:07", weekday: days });
});

test("round trips a one-time local date without a timezone shift", () => {
  const local = "2028-02-29T23:57";
  const trigger = formTrigger("once", fields({ at: local }));
  expect(trigger).toEqual({ kind: "once", at: new Date(2028, 1, 29, 23, 57).getTime() });
  expect(localDateTime(trigger)).toBe(local);
});

test("keeps an advanced cron expression and timezone when reopened", () => {
  const cron = "*/15 8-17 * * 1-5";
  const trigger = formTrigger("cron", fields({ cron, timezone: "Europe/Paris" }));
  expect(trigger).toEqual({ kind: "cron", expression: cron, timezone: "Europe/Paris" });
  expect(repeatDefaults(trigger).kind).toBe("cron");
});

test("normalizes manual recurrence input and preserves its anchor and editor mode", () => {
  const rule = "FREQ=WEEKLY;BYDAY=TU,TH";
  const saved = { kind: "rrule", rule, timezone: "UTC", anchorAt: 1000 } as const;
  const trigger = formTrigger(
    "rrule",
    fields({ rule: "  freq=weekly;byday=tu,th  ", timezone: "UTC" }),
    saved,
  );
  expect(trigger).toEqual(saved);
  expect(repeatDefaults(trigger).kind).toBe("rrule");
});

// Expected instants are calendar fixtures, independent of the scheduler and preview code.
interface TimingCase {
  start: string;
  values: Record<string, string>;
  due: string[];
}
const timingCases: Record<Frequency, TimingCase[]> = {
  once: [
    { start: "2026-01-01T11:59", values: { at: "2026-01-01T12:00" }, due: ["2026-01-01T12:00"] },
  ],
  interval: [
    {
      start: "2026-01-01T23:59Z",
      values: { amount: "2", intervalUnit: "minutes" },
      due: ["2026-01-02T00:01Z", "2026-01-02T00:03Z"],
    },
    {
      start: "2026-01-01T23:59Z",
      values: { amount: "1.5", intervalUnit: "hours" },
      due: ["2026-01-02T01:29Z", "2026-01-02T02:59Z"],
    },
  ],
  daily: [
    {
      start: "2026-03-07T13:59Z",
      values: { time: "09:00", timezone: "America/New_York" },
      due: ["2026-03-07T14:00Z", "2026-03-08T13:00Z"],
    },
  ],
  weekdays: [
    {
      start: "2026-03-06T13:59Z",
      values: { time: "09:00", timezone: "America/New_York" },
      due: ["2026-03-06T14:00Z", "2026-03-09T13:00Z"],
    },
  ],
  weekly: [
    {
      start: "2026-01-03T16:00Z",
      values: { time: "00:05", weekday: "0", timezone: "Asia/Shanghai" },
      due: ["2026-01-03T16:05Z", "2026-01-10T16:05Z"],
    },
  ],
  cron: [
    {
      start: "2026-01-01T23:47Z",
      values: { cron: "*/15 * * * *" },
      due: ["2026-01-02T00:00Z", "2026-01-02T00:15Z"],
    },
  ],
  rrule: [
    {
      start: "2026-01-01T08:59Z",
      values: { rule: "FREQ=DAILY;COUNT=2;BYHOUR=9;BYMINUTE=0" },
      due: ["2026-01-01T09:00Z", "2026-01-02T09:00Z"],
    },
  ],
  custom: [
    {
      start: "2026-01-01T08:29Z",
      values: { unit: "HOURLY", every: "2", minute: "30" },
      due: ["2026-01-01T08:30Z", "2026-01-01T10:30Z"],
    },
    {
      start: "2026-01-01T08:59Z",
      values: { unit: "DAILY", every: "2", time: "09:00" },
      due: ["2026-01-01T09:00Z", "2026-01-03T09:00Z"],
    },
    {
      start: "2026-01-05T08:59Z",
      values: { unit: "WEEKLY", every: "2", days: "MO,WE", time: "09:00" },
      due: ["2026-01-05T09:00Z", "2026-01-07T09:00Z", "2026-01-19T09:00Z"],
    },
    {
      start: "2026-01-31T08:59Z",
      values: { unit: "MONTHLY", every: "1", dates: "31", time: "09:00" },
      due: ["2026-01-31T09:00Z", "2026-03-31T09:00Z"],
    },
    {
      start: "2028-02-29T08:59Z",
      values: { unit: "YEARLY", every: "1", months: "2", dates: "29", time: "09:00" },
      due: ["2028-02-29T09:00Z", "2032-02-29T09:00Z"],
    },
  ],
};

for (const kind of Object.keys(timingCases) as Frequency[]) {
  test.each(timingCases[kind])(
    "dispatches " + kind + " $values on its timer deadlines",
    async ({ start, values, due }) => {
      const directory = await mkdtemp(join(tmpdir(), "loop-deadlines-"));
      const executions: number[] = [];
      const scheduler = new ScheduleService(directory, {
        available: () => true,
        execute: async () => {
          executions.push(Date.now());
          return "completed";
        },
      });
      vi.useFakeTimers({ now: Date.parse(start), toFake: ["Date", "setTimeout", "clearTimeout"] });
      // Observe work launched by the service's own timer; never invoke tick to force dispatch.
      const ticks = vi.spyOn(scheduler, "tick");
      const advance = async (milliseconds: number) => {
        await vi.advanceTimersByTimeAsync(milliseconds);
        await Promise.all(ticks.mock.results.map((result) => result.value));
        const timeout = performance.now() + 2000;
        while (scheduler.busy && performance.now() < timeout) await waitForIO(1);
        expect(scheduler.busy).toBe(false);
        expect(scheduler.error).toBeUndefined();
      };
      try {
        await scheduler.start();
        const trigger = formTrigger(kind, fields({ timezone: "UTC", ...values }));
        const plan = await scheduler.put({
          name: "Timing test",
          projectId: "demo",
          prompt: "Check time",
          trigger,
          permission: "read-only",
          missed: "skip",
        });
        const expected: number[] = [];
        for (const date of due) {
          const deadline = Date.parse(date);
          expect(scheduler.list()[0]?.next).toBe(deadline);
          // Skip idle months or years, then let the normal minute calibration wake before the deadline.
          const remaining = deadline - Date.now();
          if (remaining > 60_001) vi.setSystemTime(deadline - 60_001);
          await advance(deadline - Date.now() - 1);
          expect(executions).toEqual(expected);
          await advance(1);
          expected.push(deadline);
          expect(executions).toEqual(expected);
          expect(await scheduler.history(plan.id)).toMatchObject(
            expected.toReversed().map((time) => ({
              source: "timer",
              status: "completed",
              scheduledFor: time,
              startedAt: time,
            })),
          );
        }
        if (kind === "once" || kind === "rrule") {
          expect(scheduler.list()[0]).toMatchObject({ status: "completed", next: null });
          await advance(60_000);
          expect(executions).toEqual(expected);
        }
      } finally {
        await scheduler.close();
        vi.useRealTimers();
        ticks.mockRestore();
        await rm(directory, { recursive: true, force: true });
      }
    },
  );
}
