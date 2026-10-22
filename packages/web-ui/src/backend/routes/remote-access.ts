import type { RemoteAccessStatus } from "../../shared/remote-access";
import { HttpError } from "../http/errors";
import { readBody } from "../http/input";
import type { RemoteAccessController } from "../remote-access/controller";
import { createLocalControl } from "../remote-access/local-control";
import { localDeviceRoutes } from "../remote-access/local-device-routes";
import type { RemoteDevices } from "../remote-access/remote-devices";

export const remoteAccessRoutes = (controller: RemoteAccessController, devices?: RemoteDevices) => {
  const control = createLocalControl();
  return async (request: Request, url: URL): Promise<Response | undefined> => {
    if (devices && url.pathname.startsWith("/api/remote-access/")) {
      if (request.method !== "GET") control.assert(request);
      const response = await localDeviceRoutes(request, devices);
      if (request.method === "GET") response.headers.set("Set-Cookie", control.cookie);
      return response;
    }
    if (url.pathname !== "/api/remote-access") return;
    if (request.method === "GET") {
      let status: RemoteAccessStatus;
      try {
        status =
          url.searchParams.get("refresh") === "1"
            ? await controller.refresh()
            : controller.status();
      } catch {
        throw new HttpError(503, "remote_status_failed");
      }
      return Response.json(status, {
        headers: {
          "Cache-Control": "no-store",
          "Set-Cookie": control.cookie,
        },
      });
    }
    if (request.method !== "POST") throw new HttpError(405, "method_not_allowed");
    control.assert(request);
    const body = await readBody(request, 1024);
    const action = body.action;
    if (
      Object.keys(body).length !== 1 ||
      (action !== "install" &&
        action !== "uninstall" &&
        action !== "login" &&
        action !== "start" &&
        action !== "stop" &&
        action !== "logout" &&
        action !== "pause" &&
        action !== "resume")
    )
      throw new HttpError(400, "invalid_remote_command");
    try {
      controller.command(action);
    } catch {
      throw new HttpError(409, "remote_access_busy");
    }
    return Response.json(controller.status(), { status: 202 });
  };
};
