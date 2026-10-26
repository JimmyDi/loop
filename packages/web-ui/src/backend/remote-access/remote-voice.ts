import type { Server } from "node:http";

import { attachVoiceUpgrade } from "../http/voice-upgrade";
import type { VoiceUpgradeHandler } from "../http/voice-upgrade-types";
import { HttpError } from "../http/errors";
import { deviceCookie, readCredential } from "./device-credentials";
import { assertRemoteOrigin } from "./remote-policy";
import type { RemoteDevices } from "./remote-devices";

export const attachRemoteVoice = (
  server: Server,
  devices: RemoteDevices,
  localHost: () => string,
  handle: VoiceUpgradeHandler,
) =>
  attachVoiceUpgrade(
    server,
    (request) => {
      const origin = devices.origin;
      if (!origin) throw new HttpError(503, "remote_unavailable");
      const host = request.headers.get("host");
      if (host !== new URL(origin).host && host !== localHost())
        throw new HttpError(403, "invalid_host");
      if (request.headers.get("origin") !== origin) throw new HttpError(403, "invalid_origin");
      assertRemoteOrigin(request, origin);
      const device = devices.authenticate(readCredential(request, deviceCookie));
      return { principal: device.id, remote: true, expiresAt: device.expiresAt };
    },
    handle,
    (context, socket) => {
      const abort = new AbortController();
      abort.signal.addEventListener(
        "abort",
        () => socket.close(1008, "voice_authorization_changed"),
        { once: true },
      );
      return devices.track(
        { id: context.principal, name: "", createdAt: 0, expiresAt: context.expiresAt! },
        abort,
      );
    },
  );
