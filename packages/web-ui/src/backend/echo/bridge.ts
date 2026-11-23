import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import {
  createAgentSession,
  createComputerTools,
  SessionManager,
  LoopSandboxProvider,
} from "@loop/coding-agent";
import type { ComputerProvider } from "@loop/coding-agent";

import type { EchoStore } from "./store";
import type { LoopBridge } from "../loop";
import type { ProviderSettings } from "../providers/provider-settings";
import { HttpError } from "../http/errors";

export const echoProvider = async (store: EchoStore): Promise<ComputerProvider> => {
  const connection = (await store.read()).connection;
  if (!connection) throw new HttpError(409, "echo_connection_required");
  return new LoopSandboxProvider(connection.endpoint, await store.token());
};

export const createEchoBridge = (
  store: EchoStore,
  agentDir: string,
  providers: ProviderSettings,
): LoopBridge => {
  const directory = join(store.directory, "conversations");
  return {
    standaloneProject: async () => ({ id: "global", name: "Echo", cwd: store.directory }),
    models: () => providers.models(),
    archive: async () => {
      throw new HttpError(400, "echo_archive_unavailable");
    },
    deleteSessions: async () => {
      throw new HttpError(400, "echo_delete_unavailable");
    },
    list: async () => {
      const data = await store.read();
      return (await SessionManager.list(undefined, directory))
        .filter((row) => data.conversations.some((chat) => chat.id === row.id))
        .map((row) => ({
          ...row,
          workspaceId: null,
          title: data.conversations.find((chat) => chat.id === row.id)!.name,
        }));
    },
    load: async (_project, id) => {
      const data = await store.read();
      const chat = data.conversations.find((row) => row.id === id);
      if (!chat) throw new HttpError(404, "echo_conversation_not_found");
      const agent = data.agents.find((row) => row.id === chat.responderId)!;
      await mkdir(store.directory, { recursive: true, mode: 0o700 });
      const manager = await SessionManager.open(join(directory, chat.id, "meta.json"));
      await manager.setTitle({ text: chat.name, source: "user", messageIndices: [] });
      let client: ComputerProvider | undefined;
      const leases = new Map<string, { client: ComputerProvider; computerId: string }>();
      const actor = {
        conversation_id: chat.id,
        agent_id: agent.id,
        execution_id: crypto.randomUUID(),
      };
      const tools = createComputerTools(
        () => {
          if (!client) throw new Error("Computer connection unavailable");
          return client;
        },
        () => {
          if (!chat.computerId) throw new Error("Bind a computer before running tools");
          return { computerId: chat.computerId, actor };
        },
        store.directory,
        (client, computerId, leaseId) => leases.set(leaseId, { client, computerId }),
      );
      const runtime = await providers.runtime();
      const { session } = await createAgentSession({
        cwd: store.directory,
        agentDir,
        sessionManager: manager,
        modelRuntime: runtime,
        model: manager.getHeader().model ? undefined : providers.defaultModel(),
        allowUnavailableModel: true,
        tools: [],
        customTools: tools,
        remoteOnly: true,
        assistantLabel: agent.name,
        noContextFiles: true,
        title: { mode: "first-prompt" },
        systemPrompt:
          "You are " +
          agent.name +
          ". " +
          agent.instructions +
          "\nThis is an Echo conversation. Respond only as this Agent. Use remote computer tools for all filesystem, shell and browser work. Never access local files. Other participants: " +
          chat.agentIds.map((id) => data.agents.find((row) => row.id === id)?.name).join(", "),
      });
      const prompt = session.prompt.bind(session);
      const resume = session.resume.bind(session);
      session.prompt = async (...args) => {
        actor.execution_id = crypto.randomUUID();
        client = chat.computerId ? await echoProvider(store) : undefined;
        try {
          return await prompt(...args);
        } finally {
          for (const [leaseId, value] of leases)
            await value.client.release(value.computerId, leaseId).catch(() => {});
          leases.clear();
        }
      };
      session.resume = async () => {
        client = chat.computerId ? await echoProvider(store) : undefined;
        try {
          return await resume();
        } finally {
          for (const [leaseId, value] of leases)
            await value.client.release(value.computerId, leaseId).catch(() => {});
          leases.clear();
        }
      };
      return session;
    },
    setModel: async (session, choice) => {
      const model = (await providers.runtime()).getModel(choice.provider, choice.id);
      if (!model) throw new HttpError(400, "model_not_found");
      await session.setModel(model, { effort: choice.effort });
    },
  };
};
