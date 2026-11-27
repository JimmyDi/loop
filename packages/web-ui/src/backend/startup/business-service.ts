import { join } from "node:path";
import { getAgentDir, McpManager, SkillManager, VoiceResourceManager } from "@loop/coding-agent";

import { createSchedules } from "../schedules";
import { createLoopBridge } from "../loop";
import { ProjectStore } from "../projects/project-store";
import { SessionRegistry } from "../session-registry";
import { ProviderSettings } from "../providers/provider-settings";
import { WebSettings } from "../settings/web-settings";
import { createBusinessRouter } from "../business-router";
import { VoiceService } from "../voice/voice-service";

export const createBusinessService = async () => {
  const agentDir = getAgentDir();
  const projects = new ProjectStore(join(agentDir, "web-ui", "projects.json"));
  const providers = new ProviderSettings(join(agentDir, "web-ui", "provider.json"));
  const settings = new WebSettings(agentDir);
  const mcp = new McpManager(join(agentDir, "mcp.json"));
  const skills = new SkillManager(agentDir);
  skills.view(agentDir);
  const registry = new SessionRegistry(
    projects,
    createLoopBridge(agentDir, providers, settings, mcp, skills),
  );
  const voice = new VoiceService(new VoiceResourceManager(agentDir), registry);
  const schedules = createSchedules(agentDir, registry);
  await schedules.start();
  const handle = createBusinessRouter(registry, providers, settings, mcp, skills, voice, schedules);
  return {
    handle,
    voice,
    close: async () => {
      await schedules.close();
      handle.closeVoiceRoutes();
      await voice.close();
      try {
        await registry.close();
      } finally {
        await mcp.close();
        await skills.close();
      }
    },
  };
};
