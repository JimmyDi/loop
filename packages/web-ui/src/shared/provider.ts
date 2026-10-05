import type {
  ProviderCatalogEntry,
  ProviderModel,
  ProviderRuntimeConfig,
} from "@loop/coding-agent";

export type { ProviderCatalogEntry, ProviderModel };
export type ProviderConfig = ProviderRuntimeConfig;
export type ProviderRecord = Omit<ProviderConfig, "apiKey"> & { hasApiKey: boolean };
export type ProvidersView = { providers: ProviderRecord[]; catalog: ProviderCatalogEntry[] };
