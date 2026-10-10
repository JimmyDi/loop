import { dirname } from "node:path";
import { realpathSync } from "node:fs";
import type { Api, Model } from "@earendil-works/pi-ai";

import { DEFAULT_MODEL, DEFAULT_PROVIDER, getSessionDir } from "../config";
import { AgentSession } from "./agent-session";
import { createAgentSessionServices } from "./agent-session-services";
import type { ServiceOptions } from "./agent-session-services";
import { SessionManager } from "./session-manager";
import { createTools } from "./tools";
import { unavailableModel } from "./models/unavailable-model";
import { isModelEffort } from "./models/model-effort";
import type { ModelEffort } from "./models/model-effort";
import { getModelEfforts } from "./model-runtime";
import { validateRequestMaxTokens } from "./models/output-budget";
import type { SessionTitleOptions } from "./titles/types";
import { PermissionPolicy } from "./permissions/policy";
import { isPermissionPreset } from "./permissions/types";
import type { PermissionPreset } from "./permissions/types";
import type { McpManager } from "./mcp/mcp-manager";
import { SkillManager } from "./skills/skill-manager";

export type CreateAgentSessionOptions = ServiceOptions & {
  model?: Model<Api>;
  mcpManager?: McpManager;
  skillManager?: SkillManager;
  tools?: readonly string[];
  sessionManager?: SessionManager;
  maxTurns?: number;
  maxTokens?: number;
  allowUnavailableModel?: boolean;
  effort?: ModelEffort;
  title?: SessionTitleOptions;
  permissionPreset?: PermissionPreset;
};

export async function createAgentSession(
  options: CreateAgentSessionOptions = {},
): Promise<{ session: AgentSession }> {
  const allowed = new Set([
    "cwd",
    "agentDir",
    "modelRuntime",
    "settingsManager",
    "systemPrompt",
    "noContextFiles",
    "model",
    "tools",
    "sessionManager",
    "maxTurns",
    "maxTokens",
    "allowUnavailableModel",
    "effort",
    "title",
    "permissionPreset",
    "mcpManager",
    "skillManager",
  ]);

  for (const key of Object.keys(options)) {
    if (!allowed.has(key)) throw new Error("Unsupported session option: " + key);
  }

  const manager = options.sessionManager;
  validateRequestMaxTokens(options.maxTokens);
  if (options.permissionPreset !== undefined && !isPermissionPreset(options.permissionPreset))
    throw new Error("Invalid permission preset");

  if (manager?.hasPendingSave) throw new Error("Pending session save; call flush first");

  if (manager && options.cwd && realpathSync(options.cwd) !== realpathSync(manager.getCwd()))
    throw new Error("Session cwd does not match");

  const services = await createAgentSessionServices({
    ...options,
    cwd: manager?.getCwd() ?? options.cwd,
  });
  const saved = manager?.getHeader().model;
  const defaults = services.settingsManager.defaultModel;
  const provider =
    saved?.provider ?? process.env.LOOP_AI_PROVIDER ?? defaults?.provider ?? DEFAULT_PROVIDER;
  const id = saved?.id ?? process.env.LOOP_MODEL ?? defaults?.id ?? DEFAULT_MODEL;
  const restoring = !!(manager && saved && options.allowUnavailableModel && !options.model);
  const model =
    options.model ??
    services.modelRuntime.getModel(provider, id) ??
    (restoring ? unavailableModel(provider, id) : undefined);

  if (!model)
    throw new Error("Model unavailable: " + provider + "/" + id + ". Select a configured model.");

  // Validate selected tool names before creating any storage.
  createTools(services.cwd, options.tools);
  if (
    options.effort !== undefined &&
    (!isModelEffort(options.effort) ||
      (options.effort !== "default" && !getModelEfforts(model).includes(options.effort)))
  )
    throw new Error("Unsupported model effort");
  const requestedEffort = options.effort ?? saved?.effort;
  const effort =
    requestedEffort && getModelEfforts(model).includes(requestedEffort)
      ? requestedEffort
      : "default";

  if (!restoring) await services.modelRuntime.checkModel(model);

  const sessionManager =
    manager ??
    (await SessionManager.create(services.cwd, getSessionDir(services.cwd, services.agentDir)));
  const permissionPreset =
    options.permissionPreset ??
    manager?.getHeader().permissionPreset ??
    services.settingsManager.defaultPermissionPreset;
  if (sessionManager.getHeader().permissionPreset !== permissionPreset)
    await sessionManager.setPermissionPreset(permissionPreset);
  const permissionPolicy = new PermissionPolicy(
    services.cwd,
    {
      protectedPaths: [
        services.agentDir,
        ...(sessionManager.sessionFile ? [dirname(sessionManager.sessionFile)] : []),
      ],
    },
    () => sessionManager.getHeader().permissionPreset,
  );
  const tools = createTools(services.cwd, options.tools, permissionPolicy);

  if (
    !saved ||
    saved.id !== model.id ||
    saved.provider !== model.provider ||
    (options.effort !== undefined && saved.effort !== effort)
  ) {
    await sessionManager.setModel({ provider: model.provider, id: model.id, effort });
  }

  const session = new AgentSession({
    model,
    modelRuntime: services.modelRuntime,
    sessionManager,
    tools,
    systemPrompt: services.systemPrompt,
    maxTurns: options.maxTurns,
    maxTokens: options.maxTokens,
    effort,
    title: options.title,
    permissionPolicy,
    mcpManager: options.mcpManager,
    skillManager: options.skillManager ?? new SkillManager(services.agentDir),
    ownsSkillManager: !options.skillManager,
  });

  return { session };
}
