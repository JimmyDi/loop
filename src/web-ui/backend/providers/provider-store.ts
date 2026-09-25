import { mkdir, open, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";

import { CUSTOM_PROVIDER_ID } from "../../shared/provider";
import type { ProviderInput, ProviderView } from "../../shared/provider";
import { HttpError } from "../http/errors";
import { validateProvider } from "./validate-provider";

export class ProviderStore {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string) {}

  async read(): Promise<ProviderInput | undefined> {
    await this.tail;

    return this.readFile();
  }

  async view(): Promise<ProviderView | null> {
    const value = await this.read();

    if (!value) return null;

    const { apiKey, ...fields } = value;

    return { ...fields, provider: CUSTOM_PROVIDER_ID, hasApiKey: !!apiKey };
  }

  save(input: ProviderInput): Promise<ProviderInput> {
    const operation = this.tail.then(async () => {
      const value = validateProvider(input);
      const previous = await this.readFile();

      // Never carry an existing credential to a different endpoint implicitly.
      const apiKey =
        value.authentication === "none"
          ? undefined
          : (value.apiKey ?? (previous?.baseUrl === value.baseUrl ? previous.apiKey : undefined));

      if (value.authentication === "apiKey" && !apiKey)
        throw new HttpError(400, "provider_key_required");

      const saved = { ...value, apiKey };
      const temporary = this.file + "." + crypto.randomUUID() + ".tmp";

      await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });

      try {
        const handle = await open(temporary, "wx", 0o600);

        try {
          await handle.writeFile(JSON.stringify({ version: 1, ...saved }, null, 2) + "\n");
          await handle.sync();
        } finally {
          await handle.close();
        }

        await rename(temporary, this.file);
      } finally {
        await unlink(temporary).catch(() => {});
      }

      return saved;
    });

    this.tail = operation.catch(() => {});

    return operation;
  }

  private async readFile(): Promise<ProviderInput | undefined> {
    if (!(await Bun.file(this.file).exists())) return undefined;

    try {
      const data = await Bun.file(this.file).json();

      if (data?.version !== 1) throw new Error();

      const value = validateProvider(data);

      if (value.authentication === "apiKey" && !value.apiKey) throw new Error();

      return value;
    } catch {
      throw new HttpError(500, "provider_config_invalid");
    }
  }
}
