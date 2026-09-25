export const CUSTOM_PROVIDER_ID = "loop-custom";

export type ProviderInput = {
  name: string;
  baseUrl: string;
  modelId: string;
  authentication: "apiKey" | "none";
  apiKey?: string;
};

export type ProviderView = Omit<ProviderInput, "apiKey"> & {
  provider: string;
  hasApiKey: boolean;
};
