import { dirname } from "node:path";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";

import type { ProviderConfig } from "../../shared/provider";
import { HttpError } from "../http/errors";
import { validateProviderConfig } from "./validate-provider-config";

export const readProviderFile = async (file: string): Promise<ProviderConfig[]> => {
  if (!(await existsSync(file))) return [];
  try {
    const data = await readFile(file, "utf8").then(JSON.parse);
    if (data?.version !== 2 || !Array.isArray(data.providers)) throw new Error();
    const entries: unknown[] = data.providers;
    const values = entries.map((entry) => validateProviderConfig(entry as Record<string, unknown>));
    if (
      new Set(values.map((value) => value.id)).size !== values.length ||
      values.some((value) => value.authentication === "apiKey" && !value.apiKey)
    )
      throw new Error();
    return values;
  } catch {
    throw new HttpError(500, "provider_config_invalid");
  }
};

export const writeProviderFile = async (
  file: string,
  providers: ProviderConfig[],
): Promise<void> => {
  const temporary = file + "." + crypto.randomUUID() + ".tmp";
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  try {
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(
        JSON.stringify({ version: 2, providers }, null, 2) + String.fromCharCode(10),
      );
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, file);
  } finally {
    await unlink(temporary).catch(() => {});
  }
};
