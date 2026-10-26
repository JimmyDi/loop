import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import { afterEach, expect, test, vi } from "vitest";

import { createCliRuntime } from "./cli-runtime";
import { createRemoteAccess } from "./create-remote-access";
import { ConnectionStore } from "./connection-store";
import { SignInStore } from "./sign-in-store";

vi.mock("./cli-release", () => ({ supportsCli: () => true }));
vi.mock("./cli-runtime", () => ({
  createCliRuntime: vi.fn(() => ({
    installed: async () => true,
    install: async () => {},
    uninstall: async () => {},
    pauseDownload: () => false,
    login: vi.fn(async () => {}),
    logout: async () => {},
    start: vi.fn(async () => "https://example.com"),
    close: vi.fn(async () => {}),
  })),
}));

afterEach(() => vi.mocked(createCliRuntime).mockClear());

// File-backed operations include durable writes, which can take longer on CI runners.
const operationWait = { timeout: 10_000 };

test("restores sign-in from the data root without opening credentials or starting hosting", async () => {
  const root = await mkdtemp(join(tmpdir(), "loop-remote-restart-"));
  const store = new SignInStore(join(root, "web-ui", "remote-access", "sign-in.json"));
  const controllers = new Set<Awaited<ReturnType<typeof createRemoteAccess>>>();
  try {
    const first = await createRemoteAccess(root);
    controllers.add(first);
    expect((await first.refresh()).signedIn).toBe(false);
    first.command("login");
    await vi.waitFor(() => expect(first.status().phase).toBe("off"), operationWait);
    expect(await first.refresh()).toMatchObject({ installed: true, signedIn: true, phase: "off" });
    await first.close();
    controllers.delete(first);
    const second = await createRemoteAccess(root);
    controllers.add(second);
    expect(await second.refresh()).toMatchObject({ installed: true, signedIn: true, phase: "off" });
    second.command("start");
    await vi.waitFor(() => expect(second.status().phase).toBe("connected"), operationWait);
    const runtime = vi.mocked(createCliRuntime).mock.results.at(-1)?.value;
    expect(runtime.login).not.toHaveBeenCalled();
    await second.close();
    controllers.delete(second);
    expect(await store.read()).toBe(true);
    const third = await createRemoteAccess(root);
    controllers.add(third);
    await vi.waitFor(() => expect(third.status().phase).toBe("connected"), operationWait);
    third.command("stop");
    await vi.waitFor(() => expect(third.status().phase).toBe("off"), operationWait);
    third.command("uninstall");
    await vi.waitFor(() => expect(third.status().phase).toBe("off"), operationWait);
    await third.close();
    controllers.delete(third);
    expect(await store.read()).toBe(false);
  } finally {
    for (const controller of controllers) await controller.close();
    await rm(root, { recursive: true, force: true });
  }
});

test.each(["stop", "logout", "uninstall"] as const)(
  "%s clears reconnect across restarts; shutdown alone preserves it",
  async (action) => {
    const root = await mkdtemp(join(tmpdir(), "loop-remote-reconnect-"));
    const connection = new ConnectionStore(
      join(root, "web-ui", "remote-access", "connection.json"),
    );
    const controllers = new Set<Awaited<ReturnType<typeof createRemoteAccess>>>();
    try {
      const first = await createRemoteAccess(root);
      controllers.add(first);
      first.command("start");
      await vi.waitFor(() => expect(first.status().phase).toBe("connected"), operationWait);
      expect(await connection.read()).toBe(true);
      await first.close();
      controllers.delete(first);
      expect(await connection.read()).toBe(true);
      const second = await createRemoteAccess(root);
      controllers.add(second);
      expect(second.status().phase).toBe("connecting");
      expect(second.status().url).toBeUndefined();
      await vi.waitFor(() => expect(second.status().phase).toBe("connected"), operationWait);
      const runtime = vi.mocked(createCliRuntime).mock.results.at(-1)!.value;
      expect(runtime.login).not.toHaveBeenCalled();
      expect(runtime.start).toHaveBeenCalledOnce();
      if (action === "uninstall") {
        second.command("stop");
        await vi.waitFor(() => expect(second.status().phase).toBe("off"), operationWait);
      }
      second.command(action);
      await vi.waitFor(() => expect(second.status().phase).toBe("off"), operationWait);
      expect(await connection.read()).toBe(false);
      await second.close();
      controllers.delete(second);
      const third = await createRemoteAccess(root);
      controllers.add(third);
      expect(third.status().phase).toBe("off");
      await third.close();
      controllers.delete(third);
    } finally {
      for (const controller of controllers) await controller.close();
      await rm(root, { recursive: true, force: true });
    }
  },
);

test("stores the managed CLI under the supplied data root's bin/devtunnel directory", async () => {
  const root = join("synthetic-data-root", "custom-instance");
  const controller = await createRemoteAccess(root);
  try {
    expect(await controller.refresh()).toMatchObject({ installed: true, phase: "off" });
    expect(createCliRuntime).toHaveBeenCalledExactlyOnceWith(
      join(root, "bin", "devtunnel"),
      undefined,
      join(root, "web-ui", "remote-access", "tunnel.json"),
    );
  } finally {
    await controller.close();
  }
});
