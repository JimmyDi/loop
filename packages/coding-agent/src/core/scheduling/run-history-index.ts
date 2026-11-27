import { atomicWrite } from "../../utils/atomic-write";
import type { ScheduleRun, ScheduleRunCursor, ScheduleRunPage } from "./types";

const runKey = (run: ScheduleRunCursor) => run.scheduleId + "/" + run.id;
export const newestFirst = (a: ScheduleRunCursor, b: ScheduleRunCursor) =>
  b.scheduledFor - a.scheduledFor || runKey(a).localeCompare(runKey(b));

export const runHistoryPage = (
  runs: readonly ScheduleRun[],
  limit: number,
  after?: ScheduleRunCursor,
): ScheduleRunPage => {
  let start = 0;
  let end = runs.length;
  while (after && start < end) {
    const middle = Math.floor((start + end) / 2);
    if (newestFirst(runs[middle]!, after) <= 0) start = middle + 1;
    else end = middle;
  }
  const page = runs.slice(start, start + limit).map(({ input, ...run }) => ({
    ...run,
    input: { name: input.name, projectId: input.projectId },
  }));
  const last = page.at(-1);
  return {
    runs: page,
    nextCursor:
      last && start + page.length < runs.length
        ? { scheduledFor: last.scheduledFor, scheduleId: last.scheduleId, id: last.id }
        : null,
  };
};

export class RunHistoryIndex {
  private runs?: Map<string, ScheduleRun>;
  private sorted?: ScheduleRun[];
  private timer?: ReturnType<typeof setTimeout>;
  private writes = Promise.resolve();
  private dirty = false;

  constructor(private readonly file: string) {}

  async rebuild(runs: ScheduleRun[]) {
    this.runs = new Map(runs.map((run) => [runKey(run), run]));
    this.sorted = undefined;
    this.dirty = true;
    await this.flush();
  }

  update(run: ScheduleRun) {
    if (!this.runs) return; // Recovery rebuilds once after repairing individual records.
    const key = runKey(run);
    this.runs.set(key, structuredClone(run));
    this.changed();
  }

  private changed() {
    this.sorted = undefined;
    this.dirty = true;
    this.timer ??= setTimeout(() => void this.flush().catch(() => {}), 250);
    this.timer.unref();
  }

  remove(run: ScheduleRun) {
    if (!this.runs?.delete(runKey(run))) return;
    this.changed();
  }

  history(): ScheduleRun[] | undefined {
    return structuredClone(this.sortedRuns());
  }

  page(limit: number, after?: ScheduleRunCursor) {
    const runs = this.sortedRuns();
    return runs && runHistoryPage(runs, limit, after);
  }

  private sortedRuns() {
    const runs = this.runs;
    if (!runs) return;
    return (this.sorted ??= [...runs.values()].sort(newestFirst));
  }

  async flush() {
    clearTimeout(this.timer);
    this.timer = undefined;
    const write = this.writes.then(async () => {
      if (!this.runs || !this.dirty) return;
      this.dirty = false;
      const lines = [...this.runs.values()].map(
        ({ input, ...run }) =>
          JSON.stringify({ ...run, input: { name: input.name, projectId: input.projectId } }) +
          "\n",
      );
      try {
        await atomicWrite(this.file, lines.join(""));
      } catch (error) {
        this.dirty = true;
        throw error;
      }
    });
    this.writes = write.catch(() => {});
    await write;
  }
}
