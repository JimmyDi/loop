import type { Api, Model } from "@earendil-works/pi-ai";

import type { SessionOptions } from "../types/session";
import type { PermissionPreset } from "../permissions/types";
import type { ModelEffort } from "../models/model-effort";
import { resolveModelOutputTokens } from "../model-runtime";
import { assembleModelRequest } from "../model-request";
import type { ContextBudget } from "../context-budget";
import { buildSessionModelContext } from "./session-model-context";

/** Idle estimate of retained context. No dispatch, authentication or storage writes. */
export const estimateSessionContextBudget = (
  options: SessionOptions,
  model: Model<Api>,
  permissionPreset?: PermissionPreset,
  effort: ModelEffort = options.effort ?? "default",
): ContextBudget | undefined => {
  if (model.contextWindow === 0 && model.maxTokens === 0) return undefined;
  const history = options.sessionManager.messages;
  if (!history.length) return undefined;
  const { systemPrompt, tools } = buildSessionModelContext(options, model, permissionPreset);
  const retained = history.flatMap((message, messageIndex) =>
    message.role === "assistant" && ["error", "aborted"].includes(message.stopReason)
      ? []
      : [{ message, source: { type: "history" as const, messageIndex } }],
  );
  return assembleModelRequest(
    model,
    {
      systemPrompt,
      messages: retained.map(({ message }) => message),
      tools: tools.map(({ name, description, parameters }) => ({ name, description, parameters })),
    },
    options.sessionManager.getRuntimeContexts(),
    { historyMessageCount: history.length, sources: retained.map(({ source }) => source) },
    options.sessionManager.getCompactions().at(-1),
    resolveModelOutputTokens(model, {
      maxTokens: options.maxTokens,
      reasoning: effort === "default" || effort === "off" ? undefined : effort,
    }),
  ).budget;
};
