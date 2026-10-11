import type { Api, Message, Model } from "@earendil-works/pi-ai";

import type { AgentRequestConfiguration, AgentTool, PromptContent } from "@loop/agent";
import type { SessionOptions, SessionEvent } from "../types/session";
import type { PermissionPreset } from "../permissions/types";
import type { PermissionTool } from "../approvals/tool-approvals";
import type { ModelInputProjection } from "../model-input-projection";
import type { RuntimeContextSnapshot } from "../runtime-context";
import { prepareRuntimeContexts } from "../runtime-context";
import { resolveSkillSelection } from "../skills/selection";
import type { LoadedSkill } from "../skills/types";
import { createSessionStreamFn } from "../model-runtime";
import { AutomaticCompaction } from "./automatic-compaction";
import { buildSessionModelContext } from "./session-model-context";
import { prepareSystemPromptState } from "./system-prompt-state";
import type { SystemPromptCheckpoint } from "./system-prompt-state";

type InputOptions = {
  options: SessionOptions;
  model: Model<Api>;
  permissionPreset?: PermissionPreset;
  messages: Message[];
  runtimeContexts: RuntimeContextSnapshot[];
  systemPromptCheckpoints: SystemPromptCheckpoint[];
  input?: PromptContent;
  skills: string[];
  signal: AbortSignal;
};

/** Prepare an input without consuming a queue item or modifying retained session state. */
export const prepareSessionInput = async ({
  options,
  model,
  permissionPreset,
  messages,
  runtimeContexts,
  systemPromptCheckpoints,
  input,
  skills,
  signal,
}: InputOptions) => {
  const cwd = options.sessionManager.getCwd();
  const manager = options.skillManager;
  const userTurn =
    messages.filter((message) => message.role === "user").length - (input === undefined ? 1 : 0);
  const selection =
    manager && input !== undefined
      ? await resolveSkillSelection(manager, cwd, input, skills)
      : input === undefined && runtimeContexts.some((row) => row.userTurn === userTurn)
        ? []
        : skills;
  const loaded: LoadedSkill[] = [];
  for (const id of new Set(selection)) {
    signal.throwIfAborted();
    if (!manager) throw new Error("Skills are unavailable in this session");
    loaded.push(await manager.load(cwd, id, signal, true));
  }
  signal.throwIfAborted();
  const preparedContexts = loaded.length
    ? prepareRuntimeContexts(
        runtimeContexts,
        loaded.map((skill) => skill.content).join("\n\n"),
        userTurn,
        loaded,
        "user",
      )
    : runtimeContexts;
  const { systemPrompt, tools } = buildSessionModelContext(options, model, permissionPreset);
  return {
    selection,
    loaded,
    userTurn,
    tools,
    systemPrompt,
    runtimeContexts: preparedContexts,
    systemPromptCheckpoints: prepareSystemPromptState(
      systemPromptCheckpoints,
      systemPrompt,
      messages.length + (input === undefined ? 0 : 1),
    ),
    toolDisplayNames: new Map(
      tools.flatMap((tool: PermissionTool) =>
        tool.displayName ? [[tool.name, tool.displayName] as const] : [],
      ),
    ),
  };
};

type RequestOptions = {
  options: SessionOptions;
  prepared: Awaited<ReturnType<typeof prepareSessionInput>>;
  bindTools: (tools: AgentTool[]) => AgentTool[];
  history: () => Message[];
  onRetained: () => void;
  onRequest: (projection: ModelInputProjection) => void;
  notify: (event: SessionEvent) => void;
};

/** Keep preparation, model-input projection and pressure policy stable through tool continuations. */
export const createSessionRequest = ({
  options,
  prepared,
  bindTools,
  history,
  onRetained,
  onRequest,
  notify,
}: RequestOptions): {
  configuration: AgentRequestConfiguration;
  compaction: AutomaticCompaction;
} => {
  const compaction = new AutomaticCompaction({
    manager: options.sessionManager,
    runtime: options.modelRuntime,
    history,
    snapshots: prepared.runtimeContexts,
    systemPromptCheckpoints: prepared.systemPromptCheckpoints,
    onSaved: onRetained,
    notify,
  });
  return {
    compaction,
    configuration: {
      systemPrompt: prepared.systemPrompt,
      tools: bindTools(prepared.tools),
      streamFn: createSessionStreamFn(
        options.modelRuntime,
        prepared.runtimeContexts,
        (projection) => {
          onRetained();
          onRequest(projection);
        },
        (budget) => notify({ type: "context_budget", budget }),
        options.sessionManager.getCompactions().at(-1),
        (input) => compaction.prepare(input),
      ),
    },
  };
};
