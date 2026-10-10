import {
  createModels,
  createProvider,
  envApiKeyAuth,
  getSupportedThinkingLevels,
  validateToolArguments,
} from "@earendil-works/pi-ai";
import type {
  Api,
  Context,
  Model,
  Models,
  SimpleStreamOptions,
  ToolCall,
} from "@earendil-works/pi-ai";
import { adjustMaxTokensForThinking } from "@earendil-works/pi-ai/api/simple-options";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { openAIResponsesApi } from "@earendil-works/pi-ai/api/openai-responses.lazy";
import { anthropicMessagesApi } from "@earendil-works/pi-ai/api/anthropic-messages.lazy";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";

import type { AgentTool, ModelInputMetadata, StreamFn } from "@loop/agent";
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "../config";
import type { ProviderCatalogEntry, ProviderRuntimeConfig } from "./models/provider-config";
import type { ModelEffort } from "./models/model-effort";
import { resolveOutputBudget, withOutputBudget } from "./models/output-budget";
import { ContextBudgetExceededError } from "./context-budget";
import type { ContextBudget } from "./context-budget";
import { assembleModelRequest } from "./model-request";
import type { ModelInputProjection } from "./model-input-projection";
import type { RuntimeContextSnapshot } from "./runtime-context";
import type { CompactionCheckpoint } from "./context/compaction-checkpoint";

/** Nested tool calls use the same runtime validation as direct Agent calls. */
export const validateSessionToolArguments = (
  tool: AgentTool,
  args: Record<string, unknown>,
  id: string,
): Record<string, unknown> =>
  validateToolArguments(tool, {
    type: "toolCall",
    id,
    name: tool.name,
    arguments: args as ToolCall["arguments"],
  });

/** Assemble and check every main request, including sequential tool continuations. */
export const createSessionStreamFn = (
  runtime: ModelRuntime,
  snapshots: readonly RuntimeContextSnapshot[],
  onRequest: (projection: ModelInputProjection) => void,
  onBudget: (budget: ContextBudget) => void,
  checkpoint?: CompactionCheckpoint,
  prepare?: (input: {
    model: Model<Api>;
    context: Context;
    metadata: ModelInputMetadata;
    request: ReturnType<typeof assembleModelRequest>;
    signal: AbortSignal;
  }) => Promise<CompactionCheckpoint | undefined>,
): StreamFn => {
  const retained = structuredClone([...snapshots]);
  let activeCheckpoint = checkpoint;
  return (model, context, options, metadata) => {
    options?.signal?.throwIfAborted();
    if (!metadata) throw new Error("Model input origins are required for session dispatch");
    const reservedOutputTokens = resolveModelOutputTokens(model, options);
    const request = assembleModelRequest(
      model,
      context,
      retained,
      metadata,
      activeCheckpoint,
      reservedOutputTokens,
    );
    onBudget(structuredClone(request.budget));
    options?.signal?.throwIfAborted();
    const dispatch = (selected: typeof request) => {
      options?.signal?.throwIfAborted();
      if (!selected.budget.fits) throw new ContextBudgetExceededError(selected.budget);
      onRequest(selected.projection);
      return runtime.streamSimple(
        model,
        selected.context,
        withOutputBudget(options, selected.budget, onBudget),
      );
    };
    if (!prepare) return dispatch(request);
    return prepare({
      model,
      context,
      metadata,
      request,
      signal: options?.signal ?? new AbortController().signal,
    }).then((next) => {
      if (next?.id === activeCheckpoint?.id) return dispatch(request);
      activeCheckpoint = next;
      const selected = assembleModelRequest(
        model,
        context,
        retained,
        metadata,
        activeCheckpoint,
        reservedOutputTokens,
      );
      onBudget(structuredClone(selected.budget));
      return dispatch(selected);
    });
  };
};

/** Keep native adapter calculations at the model-runtime boundary. */
export const resolveModelOutputTokens = (
  model: Model<Api>,
  options?: SimpleStreamOptions,
): number => resolveOutputBudget(model, options, adjustMaxTokensForThinking);

export function getModelEfforts(model: Model<Api>): ModelEffort[] {
  return model.reasoning ? ["default", ...getSupportedThinkingLevels(model)] : [];
}

export function getProviderCatalog(): ProviderCatalogEntry[] {
  return builtinModels()
    .getProviders()
    .filter(
      (provider) =>
        provider.auth.apiKey &&
        provider.getModels().length &&
        ![
          "amazon-bedrock",
          "google-vertex",
          "azure-openai-responses",
          "cloudflare-ai-gateway",
          "cloudflare-workers-ai",
          "github-copilot",
        ].includes(provider.id),
    )
    .map((provider) => ({
      id: provider.id,
      name: provider.name,
      baseUrl: provider.baseUrl ?? provider.getModels()[0]!.baseUrl,
      api: provider.getModels()[0]!.api,
      models: provider.getModels().map(({ id, name, contextWindow, maxTokens, input }) => ({
        id,
        name,
        contextWindow,
        maxTokens,
        input: [...input],
      })),
    }));
}

export function createProviderRuntime(config: ProviderRuntimeConfig): ModelRuntime {
  if (config.authentication === "apiKey" && !config.apiKey?.trim())
    throw new Error("Provider API key required");
  const catalog = builtinModels();
  const builtin = config.kind === "builtin" ? catalog.getProvider(config.id) : undefined;
  const baseUrl =
    !builtin && config.api === "anthropic-messages"
      ? config.baseUrl.replace(/\/v1\/?$/, "")
      : config.baseUrl;
  const registry = createModels();
  const models = config.models.map((entry): Model<Api> => {
    const known = builtin?.getModels().find((model) => model.id === entry.id);
    const thinkingLevelMap = catalog.getModel(config.id, entry.id)?.thinkingLevelMap;
    return {
      ...known,
      id: entry.id,
      name: entry.name ?? known?.name ?? entry.id,
      provider: config.id,
      api: known?.api ?? config.api,
      baseUrl: known?.baseUrl ?? baseUrl,
      contextWindow: entry.contextWindow ?? known?.contextWindow ?? 128000,
      maxTokens:
        entry.maxTokens ?? known?.maxTokens ?? Math.min(4096, entry.contextWindow ?? 128000),
      input: known?.input ?? entry.input ?? ["text", "image"],
      reasoning: known?.reasoning ?? entry.reasoning ?? true,
      thinkingLevelMap: thinkingLevelMap ? structuredClone(thinkingLevelMap) : undefined,
      cost: known?.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    };
  });
  if (builtin) {
    registry.setProvider({ ...builtin, getModels: () => models });
  } else {
    const apis = {
      "openai-completions": openAICompletionsApi(),
      "openai-responses": openAIResponsesApi(),
      "anthropic-messages": anthropicMessagesApi(),
    };
    const api = apis[config.api as keyof typeof apis];
    if (!api) throw new Error("Unsupported provider protocol");
    registry.setProvider(
      createProvider({
        id: config.id,
        name: config.name,
        models,
        api,
        auth: { apiKey: envApiKeyAuth("API key", []) },
      }),
    );
  }
  const runtime = createModelRuntime({
    models: registry,
    provider: config.id,
    baseUrl: builtin ? "" : baseUrl,
    apiKey: config.authentication === "none" ? "local-placeholder" : config.apiKey,
  });
  return {
    ...runtime,
    streamSimple: (model, context, options) =>
      runtime.streamSimple(
        !builtin && !options?.reasoning ? { ...model, reasoning: false } : model,
        context,
        options,
      ),
  };
}

export type ModelRuntime = {
  getModel(provider: string, id: string): Model<Api> | undefined;
  getModels(): readonly Model<Api>[];
  checkModel(model: Model<Api>, signal?: AbortSignal): Promise<void>;
  streamSimple: StreamFn;
};

export type ModelRuntimeOptions = {
  models?: Models;
  provider?: string;
  modelId?: string;
  apiKey?: string;
  baseUrl?: string;
};

export function createModelRuntime(options: ModelRuntimeOptions = {}): ModelRuntime {
  const apiKey = options.apiKey ?? process.env.LOOP_AI_API_KEY;
  const baseUrl = (options.baseUrl ?? process.env.LOOP_AI_BASE_URL)?.trim() || undefined;
  const provider = options.provider ?? process.env.LOOP_AI_PROVIDER ?? DEFAULT_PROVIDER;
  const id = options.modelId ?? process.env.LOOP_MODEL ?? DEFAULT_MODEL;
  const registry = options.models ?? builtinModels();

  // Built-in OpenAI uses Responses. Custom OpenAI-compatible gateways
  // expose Chat Completions, including for models already in the catalog.
  if (!options.models && baseUrl && (provider === "openai" || !registry.getModel(provider, id))) {
    const catalog = registry.getModel(provider, id) ?? registry.getModel("openai", id);
    const model: Model<"openai-completions"> = {
      id,
      name: id,
      provider,
      api: "openai-completions",
      baseUrl,
      input: catalog?.input ?? ["text"],
      reasoning: catalog?.reasoning ?? false,
      thinkingLevelMap: catalog?.thinkingLevelMap
        ? structuredClone(catalog.thinkingLevelMap)
        : undefined,
      contextWindow: catalog?.contextWindow ?? 128000,
      maxTokens: 4096,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    };

    if (!("setProvider" in registry)) throw new Error("Model registry cannot register a provider");

    const mutable = registry as ReturnType<typeof builtinModels>;

    mutable.setProvider(
      createProvider({
        id: provider,
        models: [
          ...registry
            .getModels(provider)
            .filter((entry) => entry.id !== id)
            .map((entry) => ({
              ...entry,
              api: "openai-completions" as const,
              baseUrl,
              maxTokens: Math.min(entry.maxTokens, 4096),
              compat: undefined,
            })),
          model,
        ],
        auth: { apiKey: envApiKeyAuth("Loop API key", ["LOOP_AI_API_KEY"]) },
        api: openAICompletionsApi(),
      }),
    );
  }

  const configure = (model: Model<Api>): Model<Api> =>
    baseUrl && model.provider === provider ? { ...model, baseUrl } : structuredClone(model);

  return {
    getModel: (providerId, modelId) => {
      const model = registry.getModel(providerId, modelId);

      return model ? configure(model) : undefined;
    },
    getModels: () => registry.getModels().map(configure),
    checkModel: async (model, signal) => {
      signal?.throwIfAborted();

      if (!registry.getModel(model.provider, model.id))
        throw new Error("Model not found: " + model.provider + "/" + model.id);

      const auth = await registry.getAuth(model, {
        apiKey: model.provider === provider ? apiKey : undefined,
        signal,
      });

      signal?.throwIfAborted();

      if (!auth) throw new Error("No authentication configured for " + model.provider);
    },
    streamSimple: (model, context, streamOptions) =>
      registry.streamSimple(model, context, {
        ...streamOptions,
        ...(model.provider === provider && apiKey !== undefined ? { apiKey } : {}),
      }),
  };
}
