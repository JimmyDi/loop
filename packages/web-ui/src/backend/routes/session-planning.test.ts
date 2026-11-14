import { expect, test } from "vitest";

import { planningRoute } from "./session-planning";
import type { SessionController } from "../session-controller";

test("plan confirmation reserves HTTP state and rejects stale or repeated requests", async () => {
  let finish!: () => void;
  let calls = 0;
  const plan = { id: "p", version: 1, status: "ready" };
  const state = { isRunning: false, planning: { mode: "plan", plans: [plan] }, messages: [] };
  const controller = {
    busy: false,
    session: {
      state,
      model: {
        id: "example",
        provider: "example",
        name: "Example",
        input: ["text"],
        reasoning: false,
      },
      executePlan: () => {
        calls++;
        state.isRunning = true;
        return new Promise<void>((resolve) => {
          finish = resolve;
        });
      },
    },
    snapshot: { state, operation: "idle" },
    events: { publish: () => {} },
  } as unknown as SessionController;
  const request = new Request("https://example.invalid/api/sessions/s/execute-plan", {
    method: "POST",
  });
  expect(
    (await planningRoute(request, "execute-plan", { id: "p", version: 1 }, controller))?.status,
  ).toBe(202);
  expect(controller.snapshot.operation).toBe("prompt");
  expect(calls).toBe(1);
  await expect(
    planningRoute(request, "execute-plan", { id: "p", version: 1 }, controller),
  ).rejects.toMatchObject({ status: 409 });
  // Keep the mocked session busy so the pending run cannot be confirmed again.
  finish();
});

test("skip saves completion and rejects stale or repeated HTTP decisions", async () => {
  const state = {
    isRunning: false,
    planning: { mode: "plan", plans: [{ id: "p", version: 1, status: "ready" }] },
    messages: [],
  };
  let calls = 0;
  const controller = {
    busy: false,
    session: {
      state,
      skipPlan: async () => {
        calls++;
        state.planning.mode = "execute";
        state.planning.plans[0]!.status = "skipped";
      },
    },
    command: async (_action: string, action: () => Promise<void>) => action(),
    snapshot: { state, operation: "idle" },
  } as unknown as SessionController;
  const request = new Request("https://example.invalid/api/sessions/s/skip-plan", {
    method: "POST",
  });
  await expect(
    planningRoute(request, "skip-plan", { id: "p", version: 2 }, controller),
  ).rejects.toMatchObject({ status: 409 });
  expect(
    (await planningRoute(request, "skip-plan", { id: "p", version: 1 }, controller))?.status,
  ).toBe(200);
  expect(calls).toBe(1);
  await expect(
    planningRoute(request, "skip-plan", { id: "p", version: 1 }, controller),
  ).rejects.toMatchObject({ status: 409 });
});
