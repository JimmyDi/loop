import type { Api, Model } from "@earendil-works/pi-ai";

import type { AgentTool } from "@loop/agent";

import type { SessionOptions } from "../types/session";
import type { PermissionPreset } from "../permissions/types";
import { buildPermissionContext } from "../permissions/permission-context";
import { renderSystemPromptSection } from "../system-prompt";
import { buildCapabilityPrompt } from "../capability-prompt";
import { createSkillTool } from "../skills/skill-tool";
import { createCodemodeTool } from "../codemode/tool";

import { createUserInputTool } from "../user-input/user-input-tool";

/** Snapshot ready capabilities without waiting for discovery or executing tools. */
export const buildSessionModelContext = (
  options: SessionOptions,
  model: Model<Api>,
  permissionPreset?: PermissionPreset,
): { systemPrompt: string; tools: AgentTool[] } => {
  const cwd = options.sessionManager.getCwd();
  const mcp = options.mcpManager?.snapshot(cwd);
  if (options.tools.some((tool) => tool.name === "request_user_input"))
    throw new Error("The request_user_input tool name is reserved");
  const ordinaryTools = [
    createUserInputTool(options.userInputService),
    ...options.tools,
    ...(options.skillManager ? [createSkillTool(options.skillManager, cwd)] : []),
  ];
  if (mcp?.tools.length && ordinaryTools.some((tool) => tool.name === "codemode"))
    throw new Error("The codemode tool name is reserved while MCP tools are available");
  const tools = mcp?.tools.length
    ? [
        ...ordinaryTools,
        createCodemodeTool(
          [...ordinaryTools.filter((tool) => tool.name !== "request_user_input"), ...mcp.tools],
          mcp.servers,
        ),
      ]
    : ordinaryTools;
  const permission = buildPermissionContext(permissionPreset, cwd);
  const systemPrompt =
    buildCapabilityPrompt({
      systemPrompt: options.systemPrompt,
      tools,
      skills: options.skillManager?.view(cwd).skills,
      mcpServers: mcp?.servers,
      contextWindow: model.contextWindow,
    }) + (permission ? "\n\n" + renderSystemPromptSection("permissions", permission) : "");

  return { systemPrompt, tools };
};
