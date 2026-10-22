import { HttpError } from "../http/errors";
import { readBody } from "../http/input";
import type { RemoteDevices } from "./remote-devices";

export const localDeviceRoutes = async (
  request: Request,
  devices: RemoteDevices,
): Promise<Response> => {
  const path = new URL(request.url).pathname.slice("/api/remote-access".length);
  if (path === "/devices" && request.method === "GET") return Response.json(devices.status());
  if (path === "/pairing" && request.method === "POST")
    return Response.json(devices.invite(), { status: 201 });
  const pending = path.match(/^\/pairing\/([a-f0-9-]{36})$/);
  if (pending && request.method === "POST") {
    const body = await readBody(request, 1024);
    if (Object.keys(body).length !== 1 || typeof body.approve !== "boolean")
      throw new HttpError(400, "invalid_pairing_decision");
    await devices.decide(pending[1]!, body.approve);
    return Response.json(devices.status());
  }
  const device = path.match(/^\/devices\/([a-f0-9-]{36})$/);
  if (device && request.method === "DELETE") {
    await devices.revoke(device[1]!);
    return Response.json(devices.status());
  }
  throw new HttpError(404, "not_found");
};
