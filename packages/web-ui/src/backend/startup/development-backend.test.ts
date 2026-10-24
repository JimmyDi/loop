import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, vi } from "vitest";

import { startDevelopmentBackend } from "./development-backend";
import { DeviceStore } from "../remote-access/device-store";
import { RemoteDevices } from "../remote-access/remote-devices";
import { startRemoteIngress } from "../remote-access/remote-ingress";
import { deviceCookie } from "../remote-access/device-credentials";

test("business worker restarts behind the same proxy without retrying commands", async () => {
  const directory = await mkdtemp(join(import.meta.dirname, ".worker-test-"));
  vi.stubEnv("LOOP_DATA_DIR", directory);
  const backend = startDevelopmentBackend();
  const devices = new RemoteDevices(new DeviceStore(join(directory, "devices.json")));
  await devices.load();
  const origin = "https://example.test";
  devices.connect(origin);
  const pending = devices.pairing.request(
    origin,
    new URL(devices.invite().url).hash.slice(6),
    "Synthetic phone",
  );
  await devices.decide(pending.pending.id, true);
  const csrf = devices.csrf(pending.credential);
  const ingress = await startRemoteIngress(devices, backend.handle, directory, 0, backend.ready);
  await writeFile(join(directory, "remote.html"), "<html><head></head><body>Loop</body></html>");
  const remote = (path: string) =>
    fetch("http://127.0.0.1:" + ingress.port + path, {
      headers: { cookie: deviceCookie + "=" + pending.credential },
    });
  const request = () => new Request("http://localhost/api/workspaces");
  try {
    expect((await backend.handle(request())).status).toBe(503);
    await vi.waitFor(() => expect(backend.ready()).toBe(true), { timeout: 15_000 });
    expect((await backend.handle(request())).status).toBe(200);
    expect((await remote("/api/workspaces")).status).toBe(200);
    backend.restart();
    await vi.waitFor(() => expect(backend.ready()).toBe(false));
    const during = await backend.handle(
      new Request("http://localhost/api/sessions", { method: "POST", body: "{}" }),
    );
    expect(during.status).toBe(503);
    expect(await during.json()).toEqual({ code: "backend_restarting" });
    const page = await remote("/");
    expect(page.status).toBe(503);
    expect(await page.text()).toContain('http-equiv="refresh"');
    expect(await (await remote("/api/remote-session")).json()).toMatchObject({
      authorized: true,
      csrf,
    });
    await vi.waitFor(() => expect(backend.ready()).toBe(true), { timeout: 15_000 });
    expect((await backend.handle(request())).status).toBe(200);
    expect((await remote("/")).status).toBe(200);
    expect((await remote("/api/workspaces")).status).toBe(200);
    expect(devices.origin).toBe(origin);
    expect(devices.csrf(pending.credential)).toBe(csrf);
  } finally {
    await ingress.close();
    await backend.close();
    vi.unstubAllEnvs();
    await rm(directory, { recursive: true, force: true });
  }
});
