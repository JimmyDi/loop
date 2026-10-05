import type { Api, Model } from "@earendil-works/pi-ai";

// Identity-only metadata lets restored history open before a provider is configured.
// Runtime preflight still rejects prompts until a real model is selected.
export const unavailableModel = (provider: string, id: string): Model<Api> => ({
  provider,
  id,
  name: id,
  api: "openai-completions",
  baseUrl: "",
  reasoning: false,
  input: ["text"],
  contextWindow: 0,
  maxTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
});
