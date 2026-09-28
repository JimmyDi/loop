import type {
  ProviderConfig,
  ProviderInput,
  ProviderRecord,
  ProviderView,
} from "../../shared/provider";
import { HttpError } from "../http/errors";
import { readProviderFile, writeProviderFile } from "./provider-file";
import { validateProviderConfig } from "./validate-provider-config";

export class ProviderStore {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string) {}

  async configured(): Promise<boolean> {
    await this.tail;
    return Bun.file(this.file).exists();
  }

  async all(): Promise<ProviderConfig[]> {
    await this.tail;
    return readProviderFile(this.file);
  }

  async list(): Promise<ProviderRecord[]> {
    return (await this.all()).map(({ apiKey, ...value }) => ({ ...value, hasApiKey: !!apiKey }));
  }

  async read(): Promise<ProviderInput | undefined> {
    const value = (await this.all()).find((entry) => entry.id === "loop-custom");
    if (!value?.models.length) return undefined;
    return (
      value && {
        name: value.name,
        baseUrl: value.baseUrl,
        modelId: value.models[0]!.id,
        authentication: value.authentication,
        apiKey: value.apiKey,
      }
    );
  }

  async view(): Promise<ProviderView | null> {
    const value = await this.read();
    if (!value) return null;
    const { apiKey, ...fields } = value;
    return { ...fields, provider: "loop-custom", hasApiKey: !!apiKey };
  }

  async save(input: ProviderInput): Promise<ProviderInput> {
    await this.upsert({
      ...input,
      id: "loop-custom",
      kind: "custom",
      api: "openai-completions",
      models: [{ id: input.modelId }],
    });
    return (await this.read())!;
  }

  upsert(input: ProviderConfig, create = false): Promise<void> {
    return this.update(async (values) => {
      const value = validateProviderConfig(input);
      const index = values.findIndex((entry) => entry.id === value.id);
      const previous = values[index];
      if (create && previous) throw new HttpError(409, "provider_exists");
      if (previous && previous.kind !== value.kind) throw new HttpError(400, "invalid_provider");
      const sameTarget = previous?.baseUrl === value.baseUrl && previous.api === value.api;
      const apiKey =
        value.authentication === "none"
          ? undefined
          : value.apiKey || (sameTarget ? previous?.apiKey : undefined);
      if (value.authentication === "apiKey" && !apiKey)
        throw new HttpError(400, "provider_key_required");
      const saved = { ...value, apiKey };
      if (index < 0) values.push(saved);
      else values[index] = saved;
      return values;
    });
  }

  remove(id: string): Promise<void> {
    return this.update(async (values) => {
      if (!values.some((value) => value.id === id)) throw new HttpError(404, "provider_not_found");
      return values.filter((value) => value.id !== id);
    });
  }

  private update(change: (values: ProviderConfig[]) => Promise<ProviderConfig[]>): Promise<void> {
    const operation = this.tail.then(async () => {
      const values = await change(await readProviderFile(this.file));
      await writeProviderFile(this.file, values);
    });
    this.tail = operation.catch(() => {});
    return operation;
  }
}
