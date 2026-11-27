import { executeScheduleRun } from "./runner";
import { join } from "node:path";
import { acquireScheduleOwner } from "./ownership";
import { ScheduleStore } from "./store";
import { latestOccurrence, nextOccurrence, ScheduleInputError, validateSchedule } from "./time";
import type {
  Schedule,
  ScheduleHost,
  ScheduleInput,
  ScheduleRun,
  ScheduleRunCursor,
} from "./types";

const calibration = 60_000;
export class ScheduleUnavailableError extends Error {}

export class ScheduleService {
  private readonly store: ScheduleStore;
  private readonly plans = new Map<string, Schedule>();
  private release?: () => Promise<void>;
  private timer?: ReturnType<typeof setTimeout>;
  private tail: Promise<unknown> = Promise.resolve();
  private active?: { id: string; abort: AbortController; work: Promise<void> };
  private closed = false;
  private failure?: Error;

  constructor(
    agentDir: string,
    private readonly host: ScheduleHost,
  ) {
    this.store = new ScheduleStore(join(agentDir, "schedules"));
  }
  get busy() {
    return !!this.active;
  }
  get owner() {
    return !!this.release && !this.closed && !this.failure;
  }
  get error() {
    return this.failure?.message;
  }
  private ordered<T>(action: () => Promise<T>) {
    const work = this.tail.then(action);
    this.tail = work.catch(() => {});
    return work;
  }
  start() {
    return this.ordered(async () => {
      if (!this.closed && !this.release) await this.acquire().catch((error) => this.fail(error));
      this.arm();
    });
  }
  private async acquire() {
    const unlock = await acquireScheduleOwner(this.store.directory);
    if (!unlock) return;
    try {
      this.plans.clear();
      for (const plan of await this.store.recover()) this.plans.set(plan.id, plan);
      const stop = await this.host.onOwner?.();
      this.release = async () => {
        try {
          await stop?.();
        } finally {
          await unlock();
        }
      };
    } catch (error) {
      await unlock();
      throw error;
    }
  }
  private requireOwner() {
    if (!this.owner)
      throw new ScheduleUnavailableError(
        this.error ?? "Schedule service is owned by another host or stopped",
      );
  }
  private async save(plan: Schedule) {
    await this.store.save(plan).catch((error) => {
      this.fail(error);
      throw error;
    });
    this.plans.set(plan.id, plan);
  }
  list() {
    this.requireOwner();
    const plans = structuredClone([...this.plans.values()].filter((p) => p.status !== "deleted"));
    for (const plan of plans) {
      if (plan.activeRun && this.activeMatches(plan)) plan.activeRun.status = "running";
    }
    return plans;
  }
  history(id?: string) {
    this.requireOwner();
    return id === undefined ? this.store.allRuns(this.plans.keys()) : this.store.history(id);
  }
  historyPage(limit: number, after?: ScheduleRunCursor) {
    this.requireOwner();
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new ScheduleInputError("Run history limit must be between 1 and 100");
    return this.store.runsPage(this.plans.keys(), limit, after);
  }
  findRun(scheduleId: string, runId: string) {
    this.requireOwner();
    return this.store.findRun(scheduleId, runId);
  }
  changeRun(scheduleId: string, id: string, action: "archive" | "restore" | "delete") {
    return this.ordered(async () => {
      this.requireOwner();
      const run = await this.store.findRun(scheduleId, id);
      if (!run) {
        if (action === "delete") return;
        throw new ScheduleInputError("Run not found");
      }
      if (
        run.status === "queued" ||
        run.status === "running" ||
        this.plans.get(scheduleId)?.activeRun?.id === id
      )
        throw new ScheduleInputError("Run is still active");
      if (action === "delete") await this.store.deleteRun(run);
      else await this.store.saveRun({ ...run, archived: action === "archive" });
    });
  }
  private plan(id: string) {
    const plan = this.plans.get(id);
    if (!plan || plan.status === "deleted") throw new ScheduleInputError("Schedule not found");
    return plan;
  }
  put(input: ScheduleInput, id?: string) {
    const data = structuredClone(input);
    return this.ordered(async () => {
      this.requireOwner();
      const next = validateSchedule(data, Date.now());
      const current = id === undefined ? undefined : this.plan(id);
      if (current?.activeRun && !this.activeMatches(current)) await this.cancelQueued(current);
      const plan: Schedule = {
        name: data.name,
        projectId: data.projectId,
        prompt: data.prompt,
        permission: data.permission,
        missed: data.missed,
        trigger: data.trigger,
        id: current?.id ?? crypto.randomUUID(),
        revision: (current?.revision ?? 0) + 1,
        status: current?.status === "paused" ? "paused" : "active",
        next,
        activeRun: current && this.activeMatches(current) ? current.activeRun : undefined,
      };
      await this.save(plan);
      this.arm();
      return structuredClone(plan);
    });
  }
  change(id: string, action: "pause" | "resume" | "delete" | "run" | "cancel", requestId?: string) {
    return this.ordered(async () => {
      this.requireOwner();
      if (!["run", "cancel", "pause", "resume", "delete"].includes(action))
        throw new ScheduleInputError("Unknown schedule action");
      const plan = this.plan(id);
      if (action === "run") {
        if (!requestId || !/^[a-f0-9-]{36}$/.test(requestId))
          throw new ScheduleInputError("Manual run requires a UUID request ID");
        const key = "manual-" + requestId;
        const prior = await this.store.lookupRun(id, key);
        if (prior) {
          if ("deleted" in prior) throw new ScheduleInputError("Run was deleted");
          return prior;
        }
        if (plan.activeRun) throw new ScheduleInputError("Schedule already has a run");
        const once = plan.trigger.kind === "once";
        const run = await this.queue(
          once ? { ...plan, next: null, status: "completed" } : plan,
          key,
          Date.now(),
          "manual",
        );
        this.arm();
        return run;
      }
      if (action === "cancel") {
        if (this.activeMatches(plan)) this.active?.abort.abort();
        else await this.cancelQueued(plan);
      } else {
        if (action !== "resume" && !this.activeMatches(plan)) await this.cancelQueued(plan);
        const next = action === "resume" ? validateSchedule(plan, Date.now()) : null;
        await this.save({
          ...this.plan(id),
          next,
          status: action === "resume" ? "active" : action === "delete" ? "deleted" : "paused",
        });
      }
      this.arm();
    });
  }
  private activeMatches(plan: Schedule) {
    return !!plan.activeRun && this.active?.id === plan.activeRun.id + "@" + plan.id;
  }
  private async cancelQueued(plan: Schedule) {
    if (!plan.activeRun) return;
    await this.finish({ ...plan.activeRun, status: "cancelled", finishedAt: Date.now() });
  }
  private async queue(
    plan: Schedule,
    id: string,
    time: number,
    source: ScheduleRun["source"],
    skipped = false,
  ) {
    const { name, prompt, projectId, trigger, missed, permission } = plan;
    const run: ScheduleRun = {
      id,
      scheduleId: plan.id,
      revision: plan.revision,
      input: { name, prompt, projectId, trigger, missed, permission },
      source,
      scheduledFor: time,
      status: skipped ? "skipped" : "queued",
    };
    // One atomic intent includes both the occurrence and the advanced calendar cursor.
    await this.save({ ...plan, activeRun: run });
    await this.store.saveRun(run).catch((error) => {
      this.fail(error);
      throw error;
    });
    if (skipped) await this.finish({ ...run, finishedAt: Date.now() });
    return structuredClone(run);
  }
  private async finish(run: ScheduleRun) {
    await this.store.saveRun(run).catch((error) => {
      this.fail(error);
      throw error;
    });
    await this.save({ ...this.plans.get(run.scheduleId)!, activeRun: undefined });
  }
  private arm() {
    clearTimeout(this.timer);
    if (this.closed || this.failure) return;
    let wait = calibration;
    if (this.owner && !this.active) {
      for (const p of this.plans.values()) {
        if (!this.host.available(p.projectId)) continue;
        if (p.activeRun) wait = 0;
        else if (p.status === "active" && p.next !== null)
          wait = Math.min(wait, Math.max(0, p.next - Date.now()));
      }
    }
    this.timer = setTimeout(() => {
      void this.tick().catch((e) => this.fail(e));
    }, wait);
    this.timer.unref();
  }
  private fail(error: unknown) {
    this.failure = error instanceof Error ? error : new Error(String(error));
    clearTimeout(this.timer);
  }
  tick() {
    return this.ordered(async () => {
      if (this.closed || this.failure) return;
      if (!this.release) await this.acquire();
      if (this.owner && !this.active) {
        const now = Date.now();
        const plans = [...this.plans.values()]
          .filter((p) => this.host.available(p.projectId))
          .sort(
            (a, b) =>
              (a.activeRun?.scheduledFor ?? a.next ?? Infinity) -
              (b.activeRun?.scheduledFor ?? b.next ?? Infinity),
          );
        for (const plan of plans) {
          let run = plan.activeRun;
          if (!run) {
            if (plan.status !== "active" || plan.next === null || plan.next > now) continue;
            const time = latestOccurrence(plan.trigger, now, plan.next);
            const next = nextOccurrence(plan.trigger, now);
            const missed = now - time >= calibration;
            const skip = missed && plan.missed !== "run-once";
            const status =
              next !== null ? "active" : skip && plan.missed === "ask" ? "missed" : "completed";
            const occurrenceId = "at-" + time;
            const existing = await this.store.lookupRun(plan.id, occurrenceId);
            if (existing) {
              await this.save({ ...plan, next, status });
              continue;
            }
            run = await this.queue({ ...plan, next, status }, occurrenceId, time, "timer", skip);
            if (skip) continue;
          }
          // File writes above yield to project activity, maintenance and shutdown.
          if (this.closed || !this.host.available(plan.projectId)) continue;
          const abort = new AbortController();
          const work = executeScheduleRun(run, abort.signal, this.host, this.store)
            .then((result) => this.ordered(() => this.finish(result)))
            .catch((error) => this.fail(error))
            .finally(() => {
              this.active = undefined;
              this.arm();
            });
          this.active = { id: run.id + "@" + plan.id, abort, work };
          break;
        }
      }
      this.arm();
    });
  }
  async stopRun() {
    await this.tail;
    const active = this.active;
    active?.abort.abort();
    await active?.work;
  }
  async close() {
    this.closed = true;
    clearTimeout(this.timer);
    await this.stopRun();
    await this.tail;
    if (this.release) await this.store.flushIndex();
    await this.release?.();
    this.release = undefined;
  }
}
