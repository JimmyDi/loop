import { expect, test, vi } from "vitest";

import type { SessionSummary } from "../shared/protocol";
import { createScheduledChatCache } from "./scheduled-chat-cache";

const session: SessionSummary = {
  id: "chat",
  workspaceId: "project",
  createdAt: "",
  updatedAt: "",
  messageCount: 1,
  userMessageCount: 1,
  isGenerating: true,
};

test("concurrent requests share one lookup, including while the scheduler is idle", async () => {
  vi.useFakeTimers();
  try {
    const load = vi.fn(async () => null);
    const cache = createScheduledChatCache(load);
    expect(await Promise.all(Array.from({ length: 10 }, () => cache.get()))).toEqual(
      Array(10).fill(null),
    );
    await cache.get();
    expect(load).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    await cache.get();
    expect(load).toHaveBeenCalledTimes(2);
  } finally {
    vi.useRealTimers();
  }
});

test("a run change invalidates cached and in-flight summaries", async () => {
  const stale = Promise.withResolvers<SessionSummary | null>();
  const load = vi
    .fn<() => Promise<SessionSummary | null>>()
    .mockReturnValueOnce(stale.promise)
    .mockResolvedValueOnce(session)
    .mockResolvedValueOnce(null);
  const cache = createScheduledChatCache(load);
  const first = cache.get();
  cache.invalidate();
  expect(await cache.get()).toBe(session);
  stale.resolve(null);
  expect(await first).toBe(session);
  expect(load).toHaveBeenCalledTimes(2);
  cache.invalidate();
  expect(await cache.get()).toBeNull();
  expect(load).toHaveBeenCalledTimes(3);
});
