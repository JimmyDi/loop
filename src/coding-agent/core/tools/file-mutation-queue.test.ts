import { expect, test } from "bun:test";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { join } from "node:path";

import { withFileMutationQueue } from "./file-mutation-queue";

test("queued mutations cancel while another call waits for approval and never run later", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".mutation-queue-test-"));
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const controller = new AbortController();
  const order: string[] = [];
  const path = join(root, "file");
  let first: Promise<void> | undefined;
  try {
    await symlink(path, join(root, "alias"));
    first = withFileMutationQueue(path, async () => {
      entered.resolve();
      await release.promise;
      order.push("first");
    });
    await entered.promise;
    const cancelled = withFileMutationQueue(
      join(root, "alias"),
      async () => {
        order.push("cancelled");
      },
      controller.signal,
    );
    // Allow canonical path resolution to enqueue behind the waiting operation.
    await Bun.sleep(5);
    controller.abort(new Error("cancelled while queued"));
    await expect(cancelled).rejects.toThrow("cancelled while queued");
    const third = withFileMutationQueue(path, async () => {
      order.push("third");
    });
    expect(order).toEqual([]);
    release.resolve();
    await first;
    await third;
    expect(order).toEqual(["first", "third"]);
  } finally {
    release.resolve();
    await first;
    await rm(root, { recursive: true, force: true });
  }
});

test("cancelling an active mutation waits for cleanup before releasing its queue slot", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".mutation-queue-test-"));
  const entered = Promise.withResolvers<void>();
  const cleanup = Promise.withResolvers<void>();
  const controller = new AbortController();
  let settled = false;
  const running = withFileMutationQueue(
    join(root, "file"),
    async () => {
      entered.resolve();
      await cleanup.promise;
      controller.signal.throwIfAborted();
    },
    controller.signal,
  ).catch(() => {
    settled = true;
  });
  try {
    await entered.promise;
    controller.abort();
    await Promise.resolve();
    expect(settled).toBe(false);
    cleanup.resolve();
    await running;
    expect(settled).toBe(true);
  } finally {
    cleanup.resolve();
    await running;
    await rm(root, { recursive: true, force: true });
  }
});
