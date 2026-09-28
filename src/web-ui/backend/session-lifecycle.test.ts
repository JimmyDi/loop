import { expect, test } from "bun:test";

import { assertProjectIdle, closeSessions, disposeSessions } from "./session-lifecycle";
import type { SessionController } from "./session-controller";

test("lifecycle drains every close and reports failures without skipping siblings", async () => {
  const closed: number[] = [];
  const sessions = [0, 1].map(
    (id) =>
      ({
        close: async () => {
          closed.push(id);
          if (!id) throw new Error("Save failed");
        },
      }) as SessionController,
  );
  await expect(closeSessions(sessions)).rejects.toBeInstanceOf(AggregateError);
  expect(closed).toEqual([0, 1]);
  expect(() => assertProjectIdle(1, [])).toThrow("project_busy");
  expect(() => assertProjectIdle(0, [{ busy: true } as SessionController])).toThrow("project_busy");
});

test("disposal waits for all title work before releasing any session", async () => {
  const calls: string[] = [];
  const sessions = [0, 1].map(
    (id) =>
      ({
        session: {
          cancelTitle: async () => {
            await Promise.resolve();
            calls.push("cancel" + id);
          },
        },
        dispose: () => calls.push("dispose" + id),
      }) as unknown as SessionController,
  );
  await disposeSessions(sessions);
  expect(calls).toEqual(["cancel0", "cancel1", "dispose0", "dispose1"]);
});
