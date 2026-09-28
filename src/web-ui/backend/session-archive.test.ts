import { expect, test } from "bun:test";

import { updateArchive } from "./session-archive";
import type { LoopBridge } from "./loop";
import type { SessionController } from "./session-controller";

test("archive deletion refuses unarchived IDs and disposes cached sessions only after deletion", async () => {
  const calls: string[] = [];
  const project = { id: "p", name: "Example", cwd: "/example" };
  const controller = {
    workspaceId: "p",
    session: {
      sessionId: "s",
      cancelTitle: async () => {
        calls.push("cancel");
      },
    },
    dispose: () => calls.push("dispose"),
  } as unknown as SessionController;
  const instances = new Map([["s", controller]]);
  const owners = new Map([["s", "p"]]);
  let fail = true;
  let deleted = false;
  let archivedOnly: boolean | undefined;
  const loop = {
    list: async () => [
      ...(deleted ? [] : [{ id: "s", archived: true }]),
      { id: "u", archived: false },
    ],
    deleteSessions: async (_project: unknown, _ids: string[], only: boolean) => {
      archivedOnly = only;
      calls.push("delete");
      if (fail) throw new Error("Disk error");
      deleted = true;
    },
  } as unknown as LoopBridge;
  await expect(
    updateArchive(project, ["u"], "delete", { loop, instances, owners }),
  ).rejects.toThrow("session_not_archived");
  expect(calls).toEqual([]);
  await expect(
    updateArchive(project, ["s"], "delete", { loop, instances, owners }),
  ).rejects.toThrow("Disk error");
  expect(instances.get("s")).toBe(controller);
  fail = false;
  await updateArchive(project, ["s"], "delete", { loop, instances, owners });
  expect(calls).toEqual(["cancel", "delete", "cancel", "delete", "dispose"]);
  expect(instances.size).toBe(0);
  expect(owners.size).toBe(0);
  expect(archivedOnly).toBe(true);
  await updateArchive(project, ["u"], "delete-session", { loop, instances, owners });
  expect(archivedOnly).toBe(false);
  await expect(
    updateArchive(project, ["unknown"], "delete-session", { loop, instances, owners }),
  ).rejects.toThrow("session_not_found");
});
