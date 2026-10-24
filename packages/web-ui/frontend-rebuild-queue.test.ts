import { afterEach, expect, test, vi } from "vitest";

import { createFrontendRebuildQueue } from "./frontend-rebuild-queue";

afterEach(() => vi.useRealTimers());

test("continuous edits debounce and edits during a build queue a single non-overlapping rebuild", async () => {
  vi.useFakeTimers();
  const pending: Array<() => void> = [];
  const build = vi.fn(() => new Promise<void>((resolve) => pending.push(resolve)));
  const queue = createFrontendRebuildQueue(build, vi.fn());
  queue.schedule();
  queue.schedule();
  await vi.advanceTimersByTimeAsync(499);
  expect(build).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(build).toHaveBeenCalledTimes(1);
  queue.schedule();
  queue.schedule();
  await vi.advanceTimersByTimeAsync(500);
  expect(build).toHaveBeenCalledTimes(1);
  pending.shift()!();
  await Promise.resolve();
  expect(build).toHaveBeenCalledTimes(2);
  pending.shift()!();
  await queue.close();
  queue.schedule();
  await vi.advanceTimersByTimeAsync(1000);
  expect(build).toHaveBeenCalledTimes(2);
});

test("failed builds remain retryable on the next edit and shutdown cancels pending builds", async () => {
  vi.useFakeTimers();
  const failed = vi.fn();
  const build = vi.fn(async () => {}).mockRejectedValueOnce(new Error("Synthetic failure"));
  const queue = createFrontendRebuildQueue(build, failed);
  await queue.run();
  expect(failed).toHaveBeenCalledOnce();
  queue.schedule();
  await vi.advanceTimersByTimeAsync(500);
  expect(build).toHaveBeenCalledTimes(2);
  queue.schedule();
  await queue.close();
  await vi.advanceTimersByTimeAsync(1000);
  expect(build).toHaveBeenCalledTimes(2);
});
