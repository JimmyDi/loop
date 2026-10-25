import { EventEmitter } from "node:events";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { beforeEach, expect, test, vi } from "vitest";

import type { SessionRegistry } from "../session-registry";
import { allowsRemoteBusiness } from "../remote-access/remote-policy";
import { revealSession } from "./session-reveal";
import { sessionRoutes } from "./sessions";

const mocks = vi.hoisted(() => ({ spawn: vi.fn(), stat: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn }));
vi.mock("node:fs/promises", () => ({ stat: mocks.stat }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.stat.mockResolvedValue({ isDirectory: () => true });
  mocks.spawn.mockImplementation(() => {
    const child = new EventEmitter();
    queueMicrotask(() => child.emit("close", 0));
    return child;
  });
});

test("reveals the saved session directory with a separate, shell-free argument", async () => {
  const folder = join(tmpdir(), "synthetic session; example");
  await revealSession(join(folder, "meta.json"));
  expect(mocks.stat).toHaveBeenCalledWith(folder);
  expect(mocks.spawn).toHaveBeenCalledWith(
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "explorer.exe"
        : "xdg-open",
    [folder],
    { stdio: "ignore" },
  );
});

test("unsaved sessions and launcher errors do not report success", async () => {
  await expect(revealSession(undefined)).rejects.toThrow("session_not_saved");
  expect(mocks.spawn).not.toHaveBeenCalled();
  mocks.spawn.mockImplementation(() => {
    const child = new EventEmitter();
    queueMicrotask(() => child.emit("error", new Error("launcher unavailable")));
    return child;
  });
  await expect(revealSession(join(tmpdir(), "synthetic", "meta.json"))).rejects.toThrow(
    "launcher unavailable",
  );
});

test("reveal accepts POST only, derives its path from the manager and remains local-only", async () => {
  const folder = join(tmpdir(), "synthetic");
  const registry = {
    get: vi.fn().mockResolvedValue({
      workspaceId: "project",
      session: { sessionManager: { getSessionFile: () => join(folder, "meta.json") } },
    }),
    assertAvailable: vi.fn(),
  } as unknown as SessionRegistry;
  const route = sessionRoutes(registry);
  const url = new URL("http://localhost/api/sessions/synthetic/reveal");
  await expect(route(new Request(url), url)).rejects.toThrow("method_not_allowed");
  expect(mocks.spawn).not.toHaveBeenCalled();
  const result = await route(new Request(url, { method: "POST" }), url);
  expect(result?.status).toBe(204);
  expect(registry.get).toHaveBeenCalledWith("synthetic");
  expect(registry.assertAvailable).toHaveBeenCalledWith("project");
  expect(mocks.spawn.mock.calls[0]?.[1]).toEqual([folder]);
  expect(allowsRemoteBusiness(url.pathname, "POST")).toBe(false);
});
