import { HttpError } from "../http/errors";
import { readBody, requiredString } from "../http/input";
import {
  credentialCookie,
  deviceCookie,
  pairingCookie,
  readCredential,
} from "./device-credentials";
import type { RemoteDevices } from "./remote-devices";

export const remotePairingRoutes = async (
  request: Request,
  devices: RemoteDevices,
): Promise<Response | undefined> => {
  const path = new URL(request.url).pathname;
  if (path === "/api/remote-session" && request.method === "GET") {
    const credential = readCredential(request, deviceCookie);
    try {
      return Response.json({
        mode: "remote",
        authorized: true,
        device: devices.authenticate(credential),
        csrf: devices.csrf(credential),
      });
    } catch {
      return Response.json({ mode: "remote", authorized: false });
    }
  }
  if (path === "/api/remote-pairing" && request.method === "POST") {
    const body = await readBody(request, 2048);
    if (Object.keys(body).sort().join() !== "name,token")
      throw new HttpError(400, "invalid_pairing_request");
    const result = devices.pairing.request(
      devices.origin!,
      requiredString(body, "token"),
      requiredString(body, "name"),
    );
    return Response.json(
      { state: "pending", confirmation: result.pending.confirmation },
      {
        status: 202,
        headers: { "Set-Cookie": credentialCookie(pairingCookie, result.credential, 300) },
      },
    );
  }
  if (path === "/api/remote-pairing" && request.method === "GET") {
    const credential = readCredential(request, pairingCookie);
    if (!credential) return Response.json({ state: "unpaired" });
    const pending = devices.pairing.find(credential);
    if (!pending) return Response.json({ state: "expired" });
    if (pending.state !== "approved")
      return Response.json({ state: pending.state, confirmation: pending.confirmation });
    const device = devices.authenticate(credential);
    return Response.json(
      { state: "approved" },
      {
        headers: {
          "Set-Cookie": credentialCookie(
            deviceCookie,
            credential,
            Math.max(0, Math.floor((device.expiresAt - Date.now()) / 1000)),
          ),
        },
      },
    );
  }
};
