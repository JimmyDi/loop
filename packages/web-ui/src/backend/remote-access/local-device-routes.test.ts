import { expect, test, vi } from "vitest";

import { remoteAccessRoutes } from "../routes/remote-access";
import { RemoteAccessController } from "./controller";
import { RemoteDevices } from "./remote-devices";
import { DeviceStore } from "./device-store";

const origin = "http://127.0.0.1:3080";

test("local pairing approvals and revocations require the desktop control capability and origin", async () => {
  const store = new DeviceStore("unused");
  vi.spyOn(store, "read").mockResolvedValue([]);
  vi.spyOn(store, "save").mockResolvedValue();
  const devices = new RemoteDevices(store);
  await devices.load();
  devices.connect("https://example.test");
  const controller = new RemoteAccessController({ supported: false, runtime: vi.fn() });
  const route = remoteAccessRoutes(controller, devices);
  const url = new URL(origin + "/api/remote-access");
  const cookie = (await route(new Request(url), url))!.headers.get("set-cookie")!.split(";")[0]!;
  const call = (path: string, method = "GET", body?: unknown, headers = { origin, cookie }) => {
    const request = new Request(origin + "/api/remote-access" + path, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return route(request, new URL(request.url));
  };
  for (const headers of [
    { origin, cookie: "" },
    { origin: "https://other.test", cookie },
  ]) {
    await expect(call("/pairing", "POST", undefined, headers)).rejects.toMatchObject({
      status: 403,
    });
  }
  const invite = await (await call("/pairing", "POST"))!.json();
  const pending = devices.pairing.request(
    "https://example.test",
    new URL(invite.url).hash.slice(6),
    "Example phone",
  );
  const path = "/pairing/" + pending.pending.id;
  await expect(call(path, "POST", { approve: true }, { origin, cookie: "" })).rejects.toMatchObject(
    { status: 403 },
  );
  await expect(call(path, "POST", { approve: true, extra: 1 })).rejects.toMatchObject({
    status: 400,
  });
  await call(path, "POST", { approve: true });
  const status = await (await call("/devices"))!.json();
  expect(status.devices).toHaveLength(1);
  expect(JSON.stringify(status)).not.toContain("credentialHash");
  await call("/devices/" + status.devices[0].id, "DELETE");
  expect(() => devices.authenticate(pending.credential)).toThrow();
});
