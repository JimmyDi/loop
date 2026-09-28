import { getProviderCatalog } from "../../../coding-agent/index";

import type { ProviderConfig, ProviderModel } from "../../shared/provider";
import { HttpError } from "../http/errors";
import { validateProvider } from "./validate-provider";

export const validateProviderConfig = (input: Record<string, unknown>): ProviderConfig => {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new HttpError(400, "invalid_provider");
  const id = input.id;
  if (typeof id !== "string" || !/^[a-z][a-z0-9-]{0,79}$/.test(id))
    throw new HttpError(400, "invalid_provider_id");
  if (input.kind !== "builtin" && input.kind !== "custom")
    throw new HttpError(400, "invalid_provider");
  const builtin = getProviderCatalog().find((item) => item.id === id);
  if (input.kind === "builtin") {
    if (!builtin || input.authentication !== "apiKey") throw new HttpError(400, "invalid_provider");
    const { modelId: _, ...value } = validateProvider({
      ...input,
      name: builtin.name,
      baseUrl: builtin.baseUrl,
      modelId: builtin.models[0]!.id,
    });
    return { ...value, id, kind: "builtin", api: builtin.api, models: builtin.models };
  }
  if (!["openai-completions", "openai-responses", "anthropic-messages"].includes(String(input.api)))
    throw new HttpError(400, "invalid_provider_protocol");
  if (!Array.isArray(input.models) || input.models.length > 500)
    throw new HttpError(400, "invalid_provider_models");
  const ids = new Set<string>();
  const models = input.models.map((raw): ProviderModel => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new HttpError(400, "invalid_provider_models");
    const model = raw as Record<string, unknown>;
    if (
      typeof model.id !== "string" ||
      !model.id.trim() ||
      model.id.length > 200 ||
      ids.has(model.id.trim())
    )
      throw new HttpError(400, "invalid_provider_models");
    ids.add(model.id.trim());
    const capacity = (field: string) => {
      const value = model[field];
      if (value === undefined) return undefined;
      if (
        typeof value !== "number" ||
        !Number.isSafeInteger(value) ||
        value < 1 ||
        value > 100000000
      )
        throw new HttpError(400, "invalid_provider_models");
      return value;
    };
    if (model.name !== undefined && (typeof model.name !== "string" || model.name.length > 200))
      throw new HttpError(400, "invalid_provider_models");
    if (
      model.input !== undefined &&
      (!Array.isArray(model.input) ||
        !model.input.length ||
        model.input.some((item) => item !== "text" && item !== "image"))
    )
      throw new HttpError(400, "invalid_provider_models");
    const contextWindow = capacity("contextWindow");
    if (model.reasoning !== undefined && typeof model.reasoning !== "boolean")
      throw new HttpError(400, "invalid_provider_models");
    const maxTokens = capacity("maxTokens");
    if (maxTokens && maxTokens > (contextWindow ?? 128000))
      throw new HttpError(400, "invalid_provider_models");
    return {
      id: model.id.trim(),
      name: (model.name as string | undefined)?.trim() || undefined,
      contextWindow,
      maxTokens,
    };
  });
  const { modelId: _, ...value } = validateProvider({
    ...input,
    modelId: models[0]?.id ?? "unused",
  });
  return { ...value, id, kind: "custom", api: String(input.api), models };
};
