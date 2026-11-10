import { basename, dirname, join } from "node:path";
import {
  getProfileDir,
  McpManager,
  SkillManager,
  type VoiceResourceManager,
} from "@loop/coding-agent";

import { createLoopBridge } from "./loop";
import { ProjectStore } from "./projects/project-store";
import { SessionRegistry } from "./session-registry";
import { ProviderSettings } from "./providers/provider-settings";
import { WebSettings } from "./settings/web-settings";
import { createBusinessRouter } from "./business-router";
import { VoiceService } from "./voice/voice-service";

export const createProfileService = (
  root: string,
  userId: string,
  resources: VoiceResourceManager,
) => {
  const agentDir = getProfileDir(userId, root);
  const projects = new ProjectStore(join(agentDir, "web-ui", "projects.json"));
  const providers = new ProviderSettings(join(agentDir, "web-ui", "provider.json"));
  const settings = new WebSettings(agentDir);
  const mcp = new McpManager(join(agentDir, "mcp.json"));
  const skills = new SkillManager(agentDir, join(agentDir, ".agents"));
  skills.view(agentDir);
  const registry = new SessionRegistry(
    projects,
    createLoopBridge(
      agentDir,
      providers,
      settings,
      mcp,
      skills,
      join(dirname(root), basename(root) + "-workspaces", userId),
    ),
  );
  const voice = new VoiceService(resources, registry);
  const handle = createBusinessRouter(registry, providers, settings, mcp, skills, voice);
  return {
    handle,
    voice,
    registry,
    providers,
    settings,
    mcp,
    skills,
    close: async () => {
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
