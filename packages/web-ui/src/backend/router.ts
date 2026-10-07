import type { McpManager, SkillManager } from "@loop/coding-agent";

import { mcpRoutes } from "./routes/mcp";
import { skillRoutes } from "./routes/skills";
import { errorResponse } from "./http/errors";
import { assertLocalRequest } from "./http/local-request";
import { projectRoutes } from "./routes/projects";
import { sessionRoutes } from "./routes/sessions";
import { providerRoutes } from "./routes/providers";
import { generalSettingsRoutes } from "./routes/settings";
import type { WebSettings } from "./settings/web-settings";
import type { ProviderSettings } from "./providers/provider-settings";
import type { SessionRegistry } from "./session-registry";

export const createRouter = (
  registry: SessionRegistry,
  providers?: ProviderSettings,
  webSettings?: WebSettings,
  mcp?: McpManager,
  skills?: SkillManager,
) => {
  const integrations = mcp && mcpRoutes(mcp);
  const skillIntegrations = skills && skillRoutes(skills, registry);
  const projects = projectRoutes(registry);
  const sessions = sessionRoutes(registry);
  const settings = providers && providerRoutes(registry, providers);
  const general = webSettings && generalSettingsRoutes(webSettings);

  return async (request: Request): Promise<Response> => {
    try {
      assertLocalRequest(request);

      const url = new URL(request.url);
      const response =
        (await integrations?.(request, url)) ??
        (await skillIntegrations?.(request, url)) ??
        (await general?.(request, url)) ??
        (await settings?.(request, url)) ??
        (await projects(request, url)) ??
        (await sessions(request, url)) ??
        Response.json({ code: "not_found" }, { status: 404 });

      response.headers.set("Cache-Control", "no-store");

      return response;
    } catch (error) {
      return errorResponse(error);
    }
  };
};
