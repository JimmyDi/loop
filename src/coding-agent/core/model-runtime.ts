import { createProvider, envApiKeyAuth } from "@earendil-works/pi-ai";
import type { Api, Model, Models } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";

import type { StreamFn } from "../../agent";
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "../config";

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

  // Built-in OpenAI uses Responses. Custom OpenAI gateways such as Maestro
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
