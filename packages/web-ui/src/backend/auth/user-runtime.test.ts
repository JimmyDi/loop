import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { VoiceResourceManager } from "@loop/coding-agent";

import { Accounts } from "./accounts";
import { createUserRuntime } from "./user-runtime";
import { createRemoteAccess } from "../remote-access/create-remote-access";
import { RemoteAccessController } from "../remote-access/controller";
import { deviceCookie } from "../remote-access/device-credentials";
import { RemoteDevices } from "../remote-access/remote-devices";
import { DeviceStore } from "../remote-access/device-store";

vi.mock("../remote-access/create-remote-access", () => ({ createRemoteAccess: vi.fn() }));

test("paired remote ingress is bound to the owning user and password change revokes it", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".user-runtime-test-"));
  const accounts = new Accounts(root);
  await accounts.load();
  const login = await accounts.login("guest", "synthetic-password", true);
  const user = login.user;
  const origin = "https://example.test";
  const deviceFile = join(root, "users", user.id, "web-ui", "remote-access", "devices.json");
  const devices = new RemoteDevices(new DeviceStore(deviceFile));
  await devices.load();
  devices.connect(origin);
  const pair = devices.pairing.request(
    origin,
    new URL(devices.invite().url).hash.slice(6),
    "Synthetic device",
  );
  await devices.decide(pair.pending.id, true);
  let ingress:
    | Awaited<ReturnType<NonNullable<Parameters<typeof createRemoteAccess>[1]>>>
    | undefined;
  vi.mocked(createRemoteAccess).mockImplementation(async (_directory, factory) => {
    ingress = await factory!(0);
    ingress.connected?.(origin);
    return new RemoteAccessController({ supported: false, runtime: vi.fn() });
  });
  const runtime = await createUserRuntime(
    root,
    user,
    root,
    new VoiceResourceManager(root),
    accounts,
  );
  const unsubscribe = accounts.subscribe(async (id) => {
    if (id === user.id) await runtime.invalidate();
  });
  const base = "http://127.0.0.1:" + ingress!.port;
  const get = (path: string) =>
    fetch(base + path, { headers: { cookie: deviceCookie + "=" + pair.credential } });
  try {
    const userProjectFile = join(root, "users", user.id, "web-ui", "projects.json");
    await writeFile(
      userProjectFile,
      JSON.stringify([{ id: "synthetic-project", name: "Private project", cwd: root }]),
    );
    expect(await (await get("/api/auth/session")).json()).toEqual({ user });
    expect(await (await get("/api/workspaces")).json()).toMatchObject([
      { name: "Private project" },
    ]);
    expect((await get("/api/auth/users")).status).toBe(403);
    await accounts.changePassword(
      new Request("http://localhost/api/auth/password", {
        headers: { cookie: "loop_login=" + login.token },
      }),
      "synthetic-password",
      "synthetic-replacement",
    );
    expect((await get("/api/workspaces")).status).toBe(503);
    expect(await new DeviceStore(deviceFile).read()).toEqual([]);
  } finally {
    unsubscribe();
    await ingress?.close();
    await runtime.close();
    accounts.logins.close();
    vi.mocked(createRemoteAccess).mockReset();
    await rm(root, { recursive: true, force: true });
  }
});
