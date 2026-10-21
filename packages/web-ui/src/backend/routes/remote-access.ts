import { randomBytes, timingSafeEqual } from "node:crypto";

import type { RemoteAccessStatus } from "../../shared/remote-access";
import { HttpError } from "../http/errors";
import { readBody } from "../http/input";
import type { RemoteAccessController } from "../remote-access/controller";

const cookieName = "loop_remote_control";

export const remoteAccessRoutes = (controller: RemoteAccessController) => {
  const capability = randomBytes(32).toString("hex");
  return async (request: Request, url: URL): Promise<Response | undefined> => {
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
          "Set-Cookie": `${cookieName}=${capability}; HttpOnly; SameSite=Strict; Path=/api/remote-access`,
        },
      });
    }
    if (request.method !== "POST") throw new HttpError(405, "method_not_allowed");
    if (request.headers.get("origin") !== url.origin) throw new HttpError(403, "invalid_origin");
    const credential =
      request.headers
        .get("cookie")
        ?.split(";")
        .map((item) => item.trim())
        .find((item) => item.startsWith(cookieName + "="))
        ?.slice(cookieName.length + 1) ?? "";
    const bytes = Buffer.from(credential);
    if (bytes.length !== capability.length || !timingSafeEqual(bytes, Buffer.from(capability)))
      throw new HttpError(403, "invalid_control_credential");
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
