import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { atomicWrite } from "../../utils/atomic-write";
import { newestFirst, runHistoryPage, RunHistoryIndex } from "./run-history-index";
import { checkDefinition, nextOccurrence } from "./time";
import type { Schedule, ScheduleRun, ScheduleRunCursor } from "./types";

const names = async (dir: string) =>
  readdir(dir).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
const read = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, "utf8"));
const safe = (id: string) => {
  if (!/^[a-z0-9-]{1,90}$/i.test(id)) throw new Error("Invalid schedule record ID");
  return id;
};
export class ScheduleStore {
  private readonly index: RunHistoryIndex;

  constructor(readonly directory: string) {
    this.index = new RunHistoryIndex(join(directory, "runs.jsonl"));
  }
  async load(): Promise<Schedule[]> {
    const ids = (await names(this.directory)).filter((id) => /^[a-f0-9-]{36}$/.test(id));
    const result: Schedule[] = [];
    for (const id of ids) {
      // An interrupted first atomic write can leave an empty directory.
      const schedule = await read<Schedule>(join(this.directory, id, "schedule.json")).catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") return undefined;
          throw error;
        },
      );
      if (schedule) {
        if (schedule.id !== id) throw new Error("Schedule ID mismatch");
        checkDefinition(schedule);
        nextOccurrence(schedule.trigger, Date.now());
        if (
          !Number.isSafeInteger(schedule.revision) ||
          !["active", "completed", "missed", "paused", "deleted"].includes(schedule.status) ||
          (schedule.status === "active" && !Number.isSafeInteger(schedule.next))
        )
          throw new Error("Invalid saved schedule");
        if (schedule.activeRun) {
          if (
            schedule.activeRun.scheduleId !== id ||
            !["queued", "skipped"].includes(schedule.activeRun.status)
          )
            throw new Error("Invalid saved run");
          checkDefinition(schedule.activeRun.input);
        }
        result.push(schedule);
      }
    }
    return result;
  }
  async recover() {
    const plans = await this.load();
    for (const plan of plans) {
      if (!plan.activeRun) continue;
      const intent = plan.activeRun;
      const run = (await this.findRun(plan.id, intent.id)) ?? intent;
      if (run.id !== intent.id || run.scheduleId !== plan.id) throw new Error("Run ID mismatch");
      if (run.status === "queued") {
        await this.saveRun(run);
        continue;
      }
      if (run.status === "skipped" && !run.finishedAt)
        await this.saveRun({ ...run, finishedAt: Date.now() });
      if (run.status === "running")
        await this.saveRun({ ...run, status: "interrupted", finishedAt: Date.now() });
      delete plan.activeRun;
      await this.save(plan);
    }
    await this.readAll(plans.map((plan) => plan.id))
      .then((runs) => this.index.rebuild(runs))
      .catch(() => {
        // The index is derived. Keep scheduling if history cannot be indexed.
      });
    return plans;
  }
  save(schedule: Schedule) {
    return atomicWrite(
      join(this.directory, safe(schedule.id), "schedule.json"),
      JSON.stringify(schedule),
    );
  }
  async saveRun(run: ScheduleRun) {
    await atomicWrite(this.runPath(run.scheduleId, run.id), JSON.stringify(run));
    this.index.update(run);
  }
  async deleteRun(run: ScheduleRun) {
    await atomicWrite(this.runPath(run.scheduleId, run.id), JSON.stringify({ deleted: true }));
    this.index.remove(run);
  }
  async allRuns(ids: Iterable<string>): Promise<ScheduleRun[]> {
    return this.index.history() ?? this.readAll(ids);
  }
  async runsPage(ids: Iterable<string>, limit: number, after?: ScheduleRunCursor) {
    return this.index.page(limit, after) ?? runHistoryPage(await this.readAll(ids), limit, after);
  }
  async flushIndex() {
    await this.index.flush().catch(() => {
      // Individual run files are committed. The next owner rebuilds the index.
    });
  }
  private async readAll(ids: Iterable<string>): Promise<ScheduleRun[]> {
    const runs: ScheduleRun[] = [];
    for (const id of ids) {
      for (const run of await this.history(id)) runs.push(run);
    }
    return runs.sort(newestFirst);
  }
  lookupRun(scheduleId: string, id: string) {
    return read<ScheduleRun | { deleted: true }>(this.runPath(scheduleId, id)).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
        return undefined;
      },
    );
  }
  async findRun(scheduleId: string, id: string) {
    const run = await this.lookupRun(scheduleId, id);
    return run && !("deleted" in run) ? run : undefined;
  }
  async history(id: string) {
    const entries = (await names(join(this.directory, safe(id), "runs"))).filter((name) =>
      name.endsWith(".json"),
    );
    const result: ScheduleRun[] = [];
    for (const name of entries) {
      const run = await this.findRun(id, name.slice(0, -5));
      if (run) result.push(run);
    }
    return result.sort((a, b) => b.scheduledFor - a.scheduledFor);
  }
  private runPath(scheduleId: string, id: string) {
    return join(this.directory, safe(scheduleId), "runs", safe(id) + ".json");
  }
}
