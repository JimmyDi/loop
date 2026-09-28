import { createAgentSession, getSessionDir, SessionManager } from "../../coding-agent/index";
import type { AgentSession, ModelRuntime } from "../../coding-agent/index";
import { join } from "node:path";

import type { ModelChoice, ModelSelection, Project, SessionSummary } from "../shared/protocol";
import { ProviderSettings } from "./providers/provider-settings";

export type SessionPort = Pick<
  AgentSession,
  | "sessionId"
  | "state"
  | "model"
  | "effort"
  | "subscribe"
  | "prompt"
  | "abort"
  | "flush"
  | "setModel"
  | "dispose"
>;

export type LoopBridge = {
  models(): Promise<ModelChoice[]>;
  list(project: Project): Promise<SessionSummary[]>;
  load(project: Project, id?: string): Promise<SessionPort>;
  setModel(session: SessionPort, choice: ModelSelection): Promise<void>;
};

export const createLoopBridge = (
  agentDir: string,
  providers = new ProviderSettings(join(agentDir, "web-ui", "provider.json")),
): LoopBridge => {
  let runtime: Promise<ModelRuntime> | undefined;
  const getRuntime = () =>
    (runtime ??= providers.runtime().catch((error) => {
      runtime = undefined;
      throw error;
    }));

  return {
    models: () => providers.models(),
    list: async (project) =>
      (await SessionManager.list(project.cwd, getSessionDir(project.cwd, agentDir))).map(
        ({ id, createdAt, updatedAt, messageCount }) => ({
          id,
          workspaceId: project.id,
          createdAt,
          updatedAt,
          messageCount,
        }),
      ),
    load: async (project, id) => {
      const records = id
        ? await SessionManager.list(project.cwd, getSessionDir(project.cwd, agentDir))
        : [];
      const record = records.find((item) => item.id === id);

      if (id && !record) throw new Error("Session not found in project");

      const sessionManager = record ? await SessionManager.open(record.path) : undefined;
      const modelRuntime = await getRuntime();
      const { session } = await createAgentSession({
        cwd: project.cwd,
        agentDir,
        sessionManager,
        modelRuntime,
        model: sessionManager ? undefined : providers.defaultModel(),
        allowUnavailableModel: true,
        effort: sessionManager ? undefined : providers.defaultEffort(),
      });

      return session;
    },
    setModel: async (session, choice) => {
      const configured = (await providers.models()).some(
        (model) => model.provider === choice.provider && model.id === choice.id,
      );
      if (!configured) throw new Error("Model not found");
      const model = (await getRuntime()).getModel(choice.provider, choice.id);

      if (!model) throw new Error("Model not found");

      await session.setModel(model, { effort: choice.effort });
      await providers.selectModel({ ...choice, effort: session.effort });
    },
  };
};
