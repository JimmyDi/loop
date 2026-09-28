import {
  createModelRuntime,
  createProviderRuntime,
  getProviderCatalog,
  getModelEfforts,
} from "../../../coding-agent/index";
import type { ModelRuntime } from "../../../coding-agent/index";

import type { ProviderConfig, ProviderInput, ProvidersView } from "../../shared/provider";
import type { ModelChoice, ModelSelection } from "../../shared/protocol";
import { HttpError } from "../http/errors";
import { ProviderStore } from "./provider-store";
import { ModelPreference } from "./model-preference";

export class ProviderSettings {
  readonly store: ProviderStore;
  private initial?: Promise<void>;
  private runtimes = new Map<string, ModelRuntime>();
  private values: ProviderConfig[] = [];
  private fallback?: ModelRuntime;
  private managed = false;
  private readonly preference: ModelPreference;

  constructor(file: string) {
    this.store = new ProviderStore(file);
    this.preference = new ModelPreference(file + ".selection");
  }

  async view(): Promise<ProvidersView> {
    await this.initialize();
    return { providers: await this.store.list(), catalog: getProviderCatalog() };
  }

  async models(): Promise<ModelChoice[]> {
    await this.initialize();
    return this.values.flatMap((provider) =>
      this.runtimes
        .get(provider.id)!
        .getModels()
        .map((model) => ({
          provider: provider.id,
          providerName: provider.name,
          id: model.id,
          name: model.name,
          efforts: getModelEfforts(model),
          input: [...model.input],
        })),
    );
  }

  async runtime(): Promise<ModelRuntime> {
    await this.initialize();
    this.fallback ??= createModelRuntime();
    const resolve = (provider: string) =>
      this.runtimes.get(provider) ?? (this.managed ? undefined : this.fallback);
    const current = (provider: string, id: string) => resolve(provider)?.getModel(provider, id);
    return {
      getModels: () =>
        this.managed
          ? this.values.flatMap((value) => this.runtimes.get(value.id)!.getModels())
          : this.fallback!.getModels(),
      getModel: current,
      checkModel: (model, signal) => {
        const latest = current(model.provider, model.id);
        if (!latest)
          return Promise.reject(new Error("Model not found. Select a configured model."));
        return resolve(model.provider)!.checkModel(latest, signal);
      },
      streamSimple: (model, context, options) => {
        const latest = current(model.provider, model.id);
        if (!latest) throw new Error("Model not found. Select a configured model.");
        return resolve(model.provider)!.streamSimple(latest, context, options);
      },
    };
  }

  defaultModel() {
    const selected = this.preference.value;
    const runtime =
      selected &&
      (this.runtimes.get(selected.provider) ?? (!this.managed ? this.fallback : undefined));
    const preferred = selected && runtime?.getModel(selected.provider, selected.id);
    if (preferred) return preferred;
    const first = this.values.find((value) => value.models.length);
    return first && this.runtimes.get(first.id)?.getModel(first.id, first.models[0]!.id);
  }

  defaultEffort() {
    const model = this.defaultModel();
    const selected = this.preference.value;
    return model &&
      selected?.provider === model.provider &&
      selected.id === model.id &&
      selected.effort &&
      getModelEfforts(model).includes(selected.effort)
      ? selected.effort
      : undefined;
  }

  async selectModel(choice: ModelSelection): Promise<void> {
    await this.preference.save(choice);
  }

  async save(input: ProviderInput): Promise<void> {
    await this.initialize();
    await this.store.save(input);
    await this.reload();
  }

  async upsert(input: ProviderConfig, create: boolean): Promise<void> {
    await this.initialize();
    if (!create && !this.values.some((value) => value.id === input.id))
      throw new HttpError(404, "provider_not_found");
    await this.store.upsert(input, create);
    await this.reload();
  }

  async remove(id: string): Promise<void> {
    await this.initialize();
    await this.store.remove(id);
    await this.reload();
  }

  private initialize(): Promise<void> {
    return (this.initial ??= this.reload().catch((error) => {
      this.initial = undefined;
      throw error;
    }));
  }

  private async reload(): Promise<void> {
    const values = await this.store.all();
    const runtimes = new Map(values.map((value) => [value.id, createProviderRuntime(value)]));
    this.values = values;
    this.runtimes = runtimes;
    this.managed = await this.store.configured();
    await this.preference.load();
  }
}
