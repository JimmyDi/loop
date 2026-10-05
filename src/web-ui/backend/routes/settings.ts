import { isPermissionPreset } from "../../../coding-agent/index";
import { HttpError } from "../http/errors";
import { readBody } from "../http/input";
import type { WebSettings } from "../settings/web-settings";

export const generalSettingsRoutes =
  (settings: WebSettings) =>
  async (request: Request, url: URL): Promise<Response | undefined> => {
    if (url.pathname !== "/api/settings/general") return;
    if (request.method === "GET") return Response.json(await settings.read());
    if (request.method !== "PUT") throw new HttpError(405, "method_not_allowed");
    const body = await readBody(request);
    if (
      Object.keys(body).some((key) => key !== "permissionPreset") ||
      !isPermissionPreset(body.permissionPreset)
    )
      throw new HttpError(400, "invalid_permission_preset");
    return Response.json(await settings.save(body.permissionPreset));
  };
