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
import type {
  ProviderCatalogEntry,
  ProviderModel,
  ProviderRuntimeConfig,
} from "../../coding-agent/index";

export type { ProviderCatalogEntry, ProviderModel };
export type ProviderConfig = ProviderRuntimeConfig;
export type ProviderRecord = Omit<ProviderConfig, "apiKey"> & { hasApiKey: boolean };
export type ProvidersView = { providers: ProviderRecord[]; catalog: ProviderCatalogEntry[] };
