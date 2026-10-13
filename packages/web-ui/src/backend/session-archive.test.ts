import { expect, test } from "vitest";

import { updateArchive } from "./session-archive";
import type { LoopBridge } from "./loop";
import type { SessionController } from "./session-controller";

test("deletion drains trace writers before removing files and evicts closed instances on failure", async () => {
  const calls: string[] = [];
  const project = { id: "p", name: "Example", cwd: "/example" };
  const controller = {
    workspaceId: "p",
    session: {
      sessionId: "s",
      cancelTitle: async () => {
        calls.push("cancel");
      },
      flushTrace: async () => {
        await Promise.resolve();
        calls.push("flushTrace");
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
  expect(instances.has("s")).toBe(false);
  expect(owners.get("s")).toBe("p");
  fail = false;
  await updateArchive(project, ["s"], "delete", { loop, instances, owners });
  expect(calls).toEqual(["cancel", "dispose", "flushTrace", "delete", "delete"]);
  expect(instances.size).toBe(0);
  expect(owners.size).toBe(0);
  expect(archivedOnly).toBe(true);
  await updateArchive(project, ["u"], "delete-session", { loop, instances, owners });
  expect(archivedOnly).toBe(false);
  await expect(
    updateArchive(project, ["unknown"], "delete-session", { loop, instances, owners }),
  ).rejects.toThrow("session_not_found");
});

test("archive changes preserve loaded sessions and never close or flush their trace", async () => {
  const calls: string[] = [];
  const project = { id: "p", name: "Example", cwd: "/example" };
  const controller = {
    workspaceId: "p",
    session: {
      sessionId: "s",
      cancelTitle: async () => calls.push("cancel"),
      flushTrace: async () => calls.push("flush"),
    },
    dispose: () => calls.push("dispose"),
  } as unknown as SessionController;
  const instances = new Map([["s", controller]]);
  const owners = new Map([["s", "p"]]);
  const loop = {
    archive: async () => {
      calls.push("archive");
    },
  } as unknown as LoopBridge;
  await updateArchive(project, ["s"], true, { loop, instances, owners });
  await updateArchive(project, ["s"], false, { loop, instances, owners });
  expect(calls).toEqual(["archive", "archive"]);
  expect(instances.get("s")).toBe(controller);
});

test("trace closure failures prevent deletion and preserve session ownership for retry", async () => {
  const project = { id: "p", name: "Example", cwd: "/example" };
  let deleted = false;
  const controller = {
    workspaceId: "p",
    session: {
      sessionId: "s",
      cancelTitle: async () => {},
      flushTrace: async () => {
        throw new Error("Close failed");
      },
    },
    dispose: () => {},
  } as unknown as SessionController;
  const instances = new Map([["s", controller]]);
  const owners = new Map([["s", "p"]]);
  const loop = {
    list: async () => [{ id: "s", archived: false }],
    deleteSessions: async () => {
      deleted = true;
    },
  } as unknown as LoopBridge;
  await expect(
    updateArchive(project, ["s"], "delete-session", { loop, instances, owners }),
  ).rejects.toThrow("Close failed");
  expect(deleted).toBe(false);
  expect(instances.size).toBe(0);
  expect(owners.get("s")).toBe("p");
});
