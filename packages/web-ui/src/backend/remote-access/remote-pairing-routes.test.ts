import { expect, test, vi } from "vitest";

import { pairingCookie } from "./device-credentials";
import { DeviceStore } from "./device-store";
import { RemoteDevices } from "./remote-devices";
import { remotePairingRoutes } from "./remote-pairing-routes";

const origin = "https://example.test";

test.each(["", pairingCookie + "=invalid"])(
  "missing or malformed pairing credentials report unpaired without granting access: %s",
  async (cookie) => {
    const devices = new RemoteDevices(new DeviceStore("unused"));
    devices.connect(origin);
    const response = await remotePairingRoutes(
      new Request(origin + "/api/remote-pairing", { headers: { cookie } }),
      devices,
    );
    expect(await response!.json()).toEqual({ state: "unpaired" });
    expect(response!.headers.has("set-cookie")).toBe(false);
    expect(devices.status().pending).toEqual([]);
  },
);

test("a pending pairing cookie resumes the request and reports expiry only after its deadline", async () => {
  const devices = new RemoteDevices(new DeviceStore("unused"));
  devices.connect(origin);
  const invite = devices.invite();
  const { credential, pending } = devices.pairing.request(
    origin,
    new URL(invite.url).hash.slice(6),
    "Example phone",
  );
  const request = () =>
    remotePairingRoutes(
      new Request(origin + "/api/remote-pairing", {
        headers: { cookie: pairingCookie + "=" + credential },
      }),
      devices,
    );
  expect(await (await request())!.json()).toEqual({
    state: "pending",
    confirmation: pending.confirmation,
  });
  const now = vi.spyOn(Date, "now").mockReturnValue(pending.expiresAt);
  try {
    const response = await request();
    expect(await response!.json()).toEqual({ state: "expired" });
    expect(response!.headers.has("set-cookie")).toBe(false);
  } finally {
    now.mockRestore();
  }
});
