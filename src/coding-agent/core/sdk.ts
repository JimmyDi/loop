import type { Api, Model } from "@earendil-works/pi-ai";
import { realpathSync } from "node:fs";

import { DEFAULT_MODEL, DEFAULT_PROVIDER, getSessionDir } from "../config";
import { AgentSession } from "./agent-session";
import { createAgentSessionServices } from "./agent-session-services";
import type { ServiceOptions } from "./agent-session-services";
import { SessionManager } from "./session-manager";
import { createTools } from "./tools";

export type CreateAgentSessionOptions = ServiceOptions & {
  model?: Model<Api>;
  tools?: readonly string[];
  sessionManager?: SessionManager;
  maxTurns?: number;
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
  ]);

  for (const key of Object.keys(options)) {
    if (!allowed.has(key)) throw new Error("Unsupported session option: " + key);
  }

  const manager = options.sessionManager;

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
  const model = options.model ?? services.modelRuntime.getModel(provider, id);

  if (!model)
    throw new Error("Model unavailable: " + provider + "/" + id + ". Select a configured model.");

  const tools = createTools(services.cwd, options.tools);

  await services.modelRuntime.checkModel(model);

  const sessionManager =
    manager ??
    (await SessionManager.create(services.cwd, getSessionDir(services.cwd, services.agentDir)));

  if (!saved || saved.id !== model.id || saved.provider !== model.provider) {
    await sessionManager.setModel({ provider: model.provider, id: model.id });
  }

  const session = new AgentSession({
    model,
    modelRuntime: services.modelRuntime,
    sessionManager,
    tools,
    systemPrompt: services.systemPrompt,
    maxTurns: options.maxTurns,
  });

  return { session };
}
