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

test("restores sign-in from the data root without opening credentials or starting hosting", async () => {
  const root = await mkdtemp(join(tmpdir(), "loop-remote-restart-"));
  const store = new SignInStore(join(root, "web-ui", "remote-access", "sign-in.json"));
  try {
    const first = await createRemoteAccess(root);
    expect((await first.refresh()).signedIn).toBe(false);
    first.command("login");
    await vi.waitFor(() => expect(first.status().phase).toBe("off"));
    expect(await first.refresh()).toMatchObject({ installed: true, signedIn: true, phase: "off" });
    await first.close();
    const second = await createRemoteAccess(root);
    expect(await second.refresh()).toMatchObject({ installed: true, signedIn: true, phase: "off" });
    second.command("start");
    await vi.waitFor(() => expect(second.status().phase).toBe("connected"));
    const runtime = vi.mocked(createCliRuntime).mock.results.at(-1)?.value;
    expect(runtime.login).not.toHaveBeenCalled();
    await second.close();
    expect(await store.read()).toBe(true);
    const third = await createRemoteAccess(root);
    await vi.waitFor(() => expect(third.status().phase).toBe("connected"));
    third.command("stop");
    await vi.waitFor(() => expect(third.status().phase).toBe("off"));
    third.command("uninstall");
    await vi.waitFor(() => expect(third.status().phase).toBe("off"));
    await third.close();
    expect(await store.read()).toBe(false);
  } finally {
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
    try {
      const first = await createRemoteAccess(root);
      first.command("start");
      await vi.waitFor(() => expect(first.status().phase).toBe("connected"));
      expect(await connection.read()).toBe(true);
      await first.close();
      expect(await connection.read()).toBe(true);
      const second = await createRemoteAccess(root);
      expect(second.status().phase).toBe("connecting");
      expect(second.status().url).toBeUndefined();
      await vi.waitFor(() => expect(second.status().phase).toBe("connected"));
      const runtime = vi.mocked(createCliRuntime).mock.results.at(-1)!.value;
      expect(runtime.login).not.toHaveBeenCalled();
      expect(runtime.start).toHaveBeenCalledOnce();
      if (action === "uninstall") {
        second.command("stop");
        await vi.waitFor(() => expect(second.status().phase).toBe("off"));
      }
      second.command(action);
      await vi.waitFor(() => expect(second.status().phase).toBe("off"));
      expect(await connection.read()).toBe(false);
      await second.close();
      const third = await createRemoteAccess(root);
      expect(third.status().phase).toBe("off");
      await third.close();
    } finally {
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
