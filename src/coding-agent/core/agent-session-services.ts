import { realpathSync } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";

import { getAgentDir } from "../config";
import { createModelRuntime } from "./model-runtime";
import type { ModelRuntime } from "./model-runtime";
import { loadResources } from "./resource-loader";
import type { ResourceOptions } from "./resource-loader";
import { SettingsManager } from "./settings-manager";

export type ServiceOptions = ResourceOptions & {
  cwd?: string;
  agentDir?: string;
  modelRuntime?: ModelRuntime;
  settingsManager?: SettingsManager;
};

export async function createAgentSessionServices(options: ServiceOptions = {}) {
  const cwd = realpathSync(options.cwd ?? process.cwd());
  const agentDir = resolve(options.agentDir ?? getAgentDir());

  if (!(await stat(cwd)).isDirectory()) throw new Error("Working directory does not exist");

  const settingsManager = options.settingsManager ?? (await SettingsManager.create(agentDir));
  const modelRuntime =
    options.modelRuntime ??
    createModelRuntime({
      provider: process.env.LOOP_AI_PROVIDER ?? settingsManager.defaultModel?.provider,
      modelId: process.env.LOOP_MODEL ?? settingsManager.defaultModel?.id,
    });

  return {
    cwd,
    agentDir,
    settingsManager,
    modelRuntime,
    systemPrompt: await loadResources(cwd, options),
  };
}

export type AgentSessionServices = Awaited<ReturnType<typeof createAgentSessionServices>>;
