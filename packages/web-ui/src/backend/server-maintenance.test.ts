import { expect, test, vi } from "vitest";

import { MaintenanceCoordinator } from "./server-maintenance";
import type { SessionController } from "./session-controller";

test("preparation excludes admitted requests and locks new local and remote requests", async () => {
  const coordinator = new MaintenanceCoordinator(
    () => [],
    () => false,
    async () => {},
  );
  let release!: () => void;
  const request = coordinator.request(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  expect(await coordinator.prepare(false)).toBe(false);
  release();
  await request;
  expect(await coordinator.prepare(false)).toBe(true);
  await expect(coordinator.request(async () => {})).rejects.toThrow("server_updating");
  coordinator.resume();
  await expect(coordinator.request(async () => 1)).resolves.toBe(1);
});

test("running tasks require explicit stop and pending saves finish before installation", async () => {
  const state = { isRunning: true, hasPendingSave: true, pendingApprovals: [{}] };
  const abort = vi.fn(async () => {
    state.isRunning = false;
    state.pendingApprovals = [];
  });
  const flush = vi.fn(async () => {
    state.hasPendingSave = false;
  });
  const session = {
    snapshot: { operation: "idle" },
    session: { state, cancelTitle: vi.fn(), flush, flushTrace: vi.fn() },
    abort,
  } as unknown as SessionController;
  const coordinator = new MaintenanceCoordinator(
    () => [session],
    () => false,
    async () => {},
  );
  expect(await coordinator.prepare(false)).toBe(false);
  expect(abort).not.toHaveBeenCalled();
  expect(await coordinator.prepare(true)).toBe(true);
  expect(abort).toHaveBeenCalledOnce();
  expect(flush).toHaveBeenCalledOnce();
});

test("save failure and stop failure prevent installation and release admission lock", async () => {
  const session = {
    snapshot: { operation: "idle" },
    session: {
      state: {},
      cancelTitle: vi.fn(),
      flush: vi.fn().mockRejectedValue(new Error("save failed")),
    },
    abort: vi.fn(),
  } as unknown as SessionController;
  const coordinator = new MaintenanceCoordinator(
    () => [session],
    () => false,
    async () => {},
  );
  await expect(coordinator.prepare(false)).rejects.toThrow("save failed");
  await expect(coordinator.request(async () => true)).resolves.toBe(true);
  vi.mocked(session.abort).mockRejectedValue(new Error("stop failed"));
  await expect(coordinator.prepare(true)).rejects.toThrow("Tasks could not be stopped");
});

test("preparation remains exclusive during cancellation and final saves", async () => {
  let release!: () => void;
  const session = {
    snapshot: { operation: "idle" },
    session: {
      state: {},
      cancelTitle: vi.fn(),
      flushTrace: vi.fn(),
      flush: () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    },
  } as unknown as SessionController;
  const coordinator = new MaintenanceCoordinator(
    () => [session],
    () => false,
    async () => {},
  );
  const preparing = coordinator.prepare(false);
  await vi.waitFor(() => expect(release).toBeTypeOf("function"));
  await expect(coordinator.request(async () => {})).rejects.toThrow("server_updating");
  await expect(coordinator.prepare(false)).rejects.toThrow("update_preparing");
  expect(() => coordinator.resume()).toThrow("update_preparing");
  release();
  expect(await preparing).toBe(true);
});

test("all sessions and background work must become idle before automatic preparation", async () => {
  const state = { isRunning: false, pendingUserInputs: [{}] };
  let backgroundBusy = true;
  const session = {
    snapshot: { operation: "idle" },
    session: { state, cancelTitle: vi.fn(), flush: vi.fn(), flushTrace: vi.fn() },
    abort: vi.fn(),
  } as unknown as SessionController;
  const coordinator = new MaintenanceCoordinator(
    () => [session],
    () => backgroundBusy,
    async () => {},
  );
  expect(coordinator.status().tasks).toBe(2);
  expect(await coordinator.prepare(false)).toBe(false);
  state.pendingUserInputs = [];
  expect(await coordinator.prepare(false)).toBe(false);
  backgroundBusy = false;
  expect(await coordinator.prepare(false)).toBe(true);
  expect(session.abort).not.toHaveBeenCalled();
});
