import { getProviderCatalog } from "../../../coding-agent/index";

import type { ProviderModel } from "../../shared/provider";
import { HttpError } from "../http/errors";
import type { ProviderStore } from "./provider-store";
import { validateProviderConfig } from "./validate-provider-config";

export const discoverModels = async (
  input: Record<string, unknown>,
  store: ProviderStore,
): Promise<ProviderModel[]> => {
  const catalog = getProviderCatalog().find((provider) => provider.id === input.id);
  if (catalog) {
    return catalog.models.map(({ id, name, contextWindow, maxTokens }) => ({
      id,
      name,
      contextWindow,
      maxTokens: maxTokens && maxTokens <= (contextWindow ?? 128000) ? maxTokens : undefined,
    }));
  }
  const value = validateProviderConfig({
    ...input,
    id: "discovery-gateway",
    kind: "custom",
    name: "Discovery",
    models: [{ id: "discovery" }],
  });
  const saved =
    typeof input.savedId === "string"
      ? (await store.all()).find((item) => item.id === input.savedId)
      : undefined;
  const sameTarget = saved?.baseUrl === value.baseUrl && saved.api === value.api;
  const apiKey =
    value.authentication === "none"
      ? undefined
      : value.apiKey || (sameTarget ? saved?.apiKey : undefined);
  if (value.authentication === "apiKey" && !apiKey)
    throw new HttpError(400, "provider_key_required");
  const anthropic = value.api === "anthropic-messages";
  const root = anthropic && !value.baseUrl.endsWith("/v1") ? value.baseUrl + "/v1" : value.baseUrl;
  const headers: Record<string, string> = anthropic ? { "anthropic-version": "2023-06-01" } : {};
  if (apiKey)
    headers[anthropic ? "x-api-key" : "authorization"] = anthropic ? apiKey : "Bearer " + apiKey;
  try {
    const response = await fetch(root + "/models", {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error();
    const reader = response.body?.getReader();
    if (!reader) throw new Error();
    let text = "";
    let size = 0;
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { value: chunk, done } = await reader.read();
        if (done) break;
        size += chunk.byteLength;
        if (size > 2_097_152) throw new Error();
        text += decoder.decode(chunk, { stream: true });
      }
      text += decoder.decode();
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    const body = JSON.parse(text);
    const rows: unknown[] = Array.isArray(body.data)
      ? body.data
      : body.models && typeof body.models === "object" && !Array.isArray(body.models)
        ? Object.entries(body.models).map(([id, entry]) =>
            entry && typeof entry === "object" ? { ...entry, id } : null,
          )
        : [];
    const models = new Map<string, ProviderModel>();
    for (const raw of rows) {
      if (!raw || typeof raw !== "object") continue;
      const model = raw as Record<string, unknown>;
      if (typeof model.id !== "string" || !model.id.trim() || model.id.length > 200) continue;
      const name = model.name ?? model.display_name;
      const capacity = (value: unknown) =>
        typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 100000000
          ? value
          : undefined;
      const contextWindow = capacity(model.contextWindow ?? model.context_window);
      const maxTokens = capacity(model.maxTokens ?? model.max_tokens ?? model.max_output_tokens);
      const id = model.id.trim();
      models.set(id, {
        id,
        name: typeof name === "string" ? name.slice(0, 200) : model.id,
        ...(contextWindow === undefined ? {} : { contextWindow }),
        ...(maxTokens === undefined || maxTokens > (contextWindow ?? 128000) ? {} : { maxTokens }),
      });
      if (models.size >= 500) break;
    }
    return [...models.values()];
  } catch {
    throw new HttpError(400, "provider_discovery_failed");
  }
};
