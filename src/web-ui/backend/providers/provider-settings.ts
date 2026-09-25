import { createModelRuntime } from "../../../coding-agent/index";
import type { ModelRuntime } from "../../../coding-agent/index";

import { CUSTOM_PROVIDER_ID } from "../../shared/provider";
import type { ProviderInput } from "../../shared/provider";
import { ProviderStore } from "./provider-store";

export class ProviderSettings {
  readonly store: ProviderStore;
  private initial?: Promise<void>;
  private custom?: ModelRuntime;
  private selection?: ProviderInput;
  private fallback?: ModelRuntime;

  constructor(file: string) {
    this.store = new ProviderStore(file);
  }

  async runtime(): Promise<ModelRuntime> {
    await this.initialize();
    this.fallback ??= createModelRuntime();
    const resolve = (provider: string) =>
      provider === CUSTOM_PROVIDER_ID && this.custom ? this.custom : this.fallback!;

    // The stable session facade resolves the latest configuration at request time.
    // Configuration changes are blocked while a session is executing.
    return {
      getModels: () => [
        ...(this.defaultModel() ? [this.defaultModel()!] : []),
        ...this.fallback!.getModels(),
      ],
      getModel: (provider, id) => resolve(provider).getModel(provider, id),
      checkModel: (model, signal) => {
        const runtime = resolve(model.provider);

        return runtime.checkModel(runtime.getModel(model.provider, model.id) ?? model, signal);
      },
      streamSimple: (model, context, options) => {
        const runtime = resolve(model.provider);

        return runtime.streamSimple(
          runtime.getModel(model.provider, model.id) ?? model,
          context,
          options,
        );
      },
    };
  }

  defaultModel() {
    const model =
      this.selection && this.custom?.getModel(CUSTOM_PROVIDER_ID, this.selection.modelId);

    return model ? { ...model, name: this.selection!.name + " / " + model.id } : undefined;
  }

  async save(input: ProviderInput): Promise<void> {
    await this.initialize();
    const value = await this.store.save(input);

    this.configure(value);
  }

  private initialize(): Promise<void> {
    return (this.initial ??= this.store
      .read()
      .then((value) => {
        if (value) this.configure(value);
      })
      .catch((error) => {
        this.initial = undefined;
        throw error;
      }));
  }

  private configure(value: ProviderInput): void {
    this.custom = createModelRuntime({
      provider: CUSTOM_PROVIDER_ID,
      modelId: value.modelId,
      baseUrl: value.baseUrl,
      apiKey: value.authentication === "none" ? "local-placeholder" : value.apiKey,
    });
    this.selection = value;
  }
}
