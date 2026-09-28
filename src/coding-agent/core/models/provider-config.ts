export type ProviderProtocol = "openai-completions" | "openai-responses" | "anthropic-messages";

export type ProviderModel = {
  id: string;
  name?: string;
  contextWindow?: number;
  maxTokens?: number;
  input?: ("text" | "image")[];
  reasoning?: boolean;
};

export type ProviderRuntimeConfig = {
  id: string;
  kind: "builtin" | "custom";
  name: string;
  baseUrl: string;
  api: string;
  models: ProviderModel[];
  authentication: "apiKey" | "none";
  apiKey?: string;
};

export type ProviderCatalogEntry = {
  id: string;
  name: string;
  baseUrl: string;
  api: string;
  models: ProviderModel[];
};
