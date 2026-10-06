import { join } from "node:path";
import {
  createAgentSession,
  getSessionDir,
  SessionArchive,
  SessionManager,
  SettingsManager,
} from "@loop/coding-agent";
import type { AgentSession, ModelRuntime, McpManager } from "@loop/coding-agent";

import type { ModelChoice, ModelSelection, Project, SessionSummary } from "../shared/protocol";
import { ProviderSettings } from "./providers/provider-settings";
import { WebSettings } from "./settings/web-settings";
import { HttpError } from "./http/errors";

export type SessionPort = Pick<
  AgentSession,
  | "sessionId"
  | "sessionManager"
  | "state"
  | "model"
  | "effort"
  | "subscribe"
  | "prompt"
  | "abort"
  | "flush"
  | "setModel"
  | "dispose"
  | "renameTitle"
  | "refreshTitle"
  | "cancelTitle"
  | "setPermissionPreset"
  | "registerApprovalHandler"
  | "respondToApproval"
>;

export type LoopBridge = {
  models(): Promise<ModelChoice[]>;
  list(project: Project): Promise<SessionSummary[]>;
  archive(project: Project, ids: string[], archived: boolean): Promise<void>;
  deleteSessions(project: Project, ids: string[], archivedOnly: boolean): Promise<void>;
  load(project: Project, id?: string): Promise<SessionPort>;
  setModel(session: SessionPort, choice: ModelSelection): Promise<void>;
};

export const createLoopBridge = (
  agentDir: string,
  providers = new ProviderSettings(join(agentDir, "web-ui", "provider.json")),
  settings = new WebSettings(agentDir),
  mcpManager?: McpManager,
): LoopBridge => {
  let runtime: Promise<ModelRuntime> | undefined;
  const archives = new Map<string, SessionArchive>();
  const archiveFor = (project: Project): SessionArchive => {
    const directory = getSessionDir(project.cwd, agentDir);
    let archive = archives.get(directory);
    if (!archive) {
      archive = new SessionArchive(directory);
      archives.set(directory, archive);
    }
    return archive;
  };
  const getRuntime = () =>
    (runtime ??= providers.runtime().catch((error) => {
      runtime = undefined;
      throw error;
    }));

  return {
    models: () => providers.models(),
    deleteSessions: (project, ids, archivedOnly) =>
      archiveFor(project).delete(project.cwd, ids, { archivedOnly }),
    archive: async (project, ids, archived) => {
      const records = await SessionManager.list(project.cwd, getSessionDir(project.cwd, agentDir));
      if (ids.some((id) => !records.some((record) => record.id === id)))
        throw new HttpError(404, "session_not_found");
      await archiveFor(project).set(ids, archived);
    },
    list: async (project) => {
      const archived = await archiveFor(project).list();
      return (await SessionManager.list(project.cwd, getSessionDir(project.cwd, agentDir))).map(
        ({
          id,
          createdAt,
          updatedAt,
          messageCount,
          userMessageCount,
          title,
          unread,
          pinnedAt,
        }) => ({
          id,
          workspaceId: project.id,
          createdAt,
          updatedAt,
          messageCount,
          userMessageCount,
          unread: unread ?? false,
          pinnedAt,
          title: title?.text,
          archived: archived.has(id),
        }),
      );
    },
    load: async (project, id) => {
      const records = id
        ? await SessionManager.list(project.cwd, getSessionDir(project.cwd, agentDir))
        : [];
      const record = records.find((item) => item.id === id);

      if (id && !record) throw new Error("Session not found in project");

      const sessionManager = record
        ? await SessionManager.open(record.path)
        : SessionManager.draft(project.cwd, getSessionDir(project.cwd, agentDir));
      const modelRuntime = await getRuntime();
      const settingsManager = await SettingsManager.create(agentDir);
      const { session } = await createAgentSession({
        mcpManager,
        cwd: project.cwd,
        agentDir,
        sessionManager,
        modelRuntime,
        settingsManager,
        model: record ? undefined : providers.defaultModel(),
        allowUnavailableModel: true,
        effort: record ? undefined : providers.defaultEffort(),
        permissionPreset: record
          ? undefined
          : ((await settings.read()).permissionPreset ?? settingsManager.defaultPermissionPreset),
        title: { mode: "first-prompt" },
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
