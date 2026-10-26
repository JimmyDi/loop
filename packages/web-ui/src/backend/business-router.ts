import type { McpManager, SkillManager } from "@loop/coding-agent";

import { mcpRoutes } from "./routes/mcp";
import { skillRoutes } from "./routes/skills";
import { projectRoutes } from "./routes/projects";
import { sessionRoutes } from "./routes/sessions";
import { sessionImageRoutes } from "./routes/session-images";
import { sessionFileRoutes } from "./routes/session-files";
import { providerRoutes } from "./routes/providers";
import { generalSettingsRoutes } from "./routes/settings";
import type { WebSettings } from "./settings/web-settings";
import type { ProviderSettings } from "./providers/provider-settings";
import type { SessionRegistry } from "./session-registry";
import type { VoiceService } from "./voice/voice-service";
import { voiceRoutes } from "./voice/voice-routes";
import type { BusinessHandler } from "./http/business-context";
import { localContext } from "./http/business-context";

export const createBusinessRouter = (
  registry: SessionRegistry,
  providers?: ProviderSettings,
  webSettings?: WebSettings,
  mcp?: McpManager,
  skills?: SkillManager,
  voice?: VoiceService,
) => {
  const voiceRoute = voice && voiceRoutes(voice);
  const routes = [
    mcp && mcpRoutes(mcp),
    skills && skillRoutes(skills, registry),
    webSettings && generalSettingsRoutes(webSettings),
    providers && providerRoutes(registry, providers),
    projectRoutes(registry),
    sessionImageRoutes(registry),
    sessionFileRoutes(registry),
    sessionRoutes(registry),
  ];
  const handle: BusinessHandler = async (request, context = localContext): Promise<Response> => {
    const url = new URL(request.url);
    const voiceResponse = await voiceRoute?.route(request, url, context);
    if (voiceResponse) return voiceResponse;
    for (const route of routes) {
      const response = await route?.(request, url);
      if (response) return response;
    }
    return Response.json({ code: "not_found" }, { status: 404 });
  };
  return Object.assign(handle, { closeVoiceRoutes: () => voiceRoute?.close() });
};
