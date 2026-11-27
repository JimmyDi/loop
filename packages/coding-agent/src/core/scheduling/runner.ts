import type { ScheduleHost, ScheduleRun } from "./types";
import type { ScheduleStore } from "./store";

export const executeScheduleRun = async (
  run: ScheduleRun,
  signal: AbortSignal,
  host: ScheduleHost,
  store: ScheduleStore,
): Promise<ScheduleRun> => {
  run = { ...run, status: "running", startedAt: Date.now() };
  await store.saveRun(run);
  const executionSignal = AbortSignal.any([signal, AbortSignal.timeout(30 * 60_000)]);
  try {
    executionSignal.throwIfAborted();
    run.status = await host.execute(
      structuredClone(run),
      async (sessionId) => {
        run.sessionId = sessionId;
        await store.saveRun(run);
      },
      executionSignal,
    );
    if (!signal.aborted && executionSignal.aborted) {
      run.status = "interrupted";
      run.error = "Schedule timed out";
    }
  } catch (error) {
    run.status = signal.aborted ? "cancelled" : "failed";
    run.error = error instanceof Error ? error.message : String(error);
  }
  return { ...run, finishedAt: Date.now() };
};
