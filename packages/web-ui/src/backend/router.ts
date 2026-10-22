import type { McpManager, SkillManager } from "@loop/coding-agent";

import { errorResponse } from "./http/errors";
import { assertLocalRequest } from "./http/local-request";
import type { WebSettings } from "./settings/web-settings";
import type { ProviderSettings } from "./providers/provider-settings";
import type { SessionRegistry } from "./session-registry";
import type { RemoteAccessController } from "./remote-access/controller";
import { remoteAccessRoutes } from "./routes/remote-access";
import { createBusinessRouter } from "./business-router";
import type { RemoteDevices } from "./remote-access/remote-devices";

export const createRouter = (
  registry: SessionRegistry,
  providers?: ProviderSettings,
  webSettings?: WebSettings,
  mcp?: McpManager,
  skills?: SkillManager,
  remoteAccess?: RemoteAccessController,
  devices?: RemoteDevices,
) => {
  const business = createBusinessRouter(registry, providers, webSettings, mcp, skills);
  const remote = remoteAccess && remoteAccessRoutes(remoteAccess, devices);

  return async (request: Request): Promise<Response> => {
    try {
      assertLocalRequest(request);

      const url = new URL(request.url);
      const response =
        url.pathname === "/api/remote-session" && request.method === "GET"
          ? Response.json({ mode: "local" })
          : ((await remote?.(request, url)) ?? (await business(request)));

      response.headers.set("Cache-Control", "no-store");

      return response;
    } catch (error) {
      return errorResponse(error);
    }
  };
};
