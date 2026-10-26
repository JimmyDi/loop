import { once } from "node:events";
import { expect, test, vi } from "vitest";
import { WebSocket } from "ws";

import { createHttpServer, listen } from "../http/node-server";
import { attachRemoteVoice } from "./remote-voice";
import { RemoteDevices } from "./remote-devices";
import { DeviceStore } from "./device-store";
import { deviceCookie } from "./device-credentials";

test("remote voice upgrades require paired credentials and terminate on durable revocation", async () => {
  const store = new DeviceStore("unused");
  vi.spyOn(store, "read").mockResolvedValue([]);
  vi.spyOn(store, "save").mockResolvedValue();
  const devices = new RemoteDevices(store);
  await devices.load();
  const origin = "https://example.test";
  devices.connect(origin);
  const token = new URL(devices.invite().url).hash.slice(6);
  const pairing = devices.pairing.request(origin, token, "Synthetic phone");
  await devices.decide(pairing.pending.id, true);
  const device = devices.authenticate(pairing.credential);
  const server = createHttpServer(() => new Response(null, { status: 404 }));
  let localHost = "";
  const closeVoice = attachRemoteVoice(
    server,
    devices,
    () => localHost,
    (socket, _id, context) => {
      expect(context.principal).toBe(device.id);
      socket.send("authorized");
    },
  );
  const url = await listen(server, 0);
  localHost = url.host;
  const address =
    url.href.replace("http:", "ws:") + "api/voice/calls/" + crypto.randomUUID() + "/socket";
  let client: WebSocket | undefined;
  try {
    const rejected = new WebSocket(address, { origin });
    await expect(once(rejected, "open")).rejects.toThrow("401");
    const wrongOrigin = new WebSocket(address, {
      origin: "https://other.example",
      headers: { Cookie: deviceCookie + "=" + pairing.credential },
    });
    await expect(once(wrongOrigin, "open")).rejects.toThrow("403");
    client = new WebSocket(address, {
      origin,
      headers: { Cookie: deviceCookie + "=" + pairing.credential },
    });
    const message = once(client, "message");
    await once(client, "open");
    expect((await message)[0].toString()).toBe("authorized");
    const closed = once(client, "close");
    await devices.revoke(device.id);
    expect((await closed)[0]).toBe(1008);
  } finally {
    client?.terminate();
    closeVoice();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
