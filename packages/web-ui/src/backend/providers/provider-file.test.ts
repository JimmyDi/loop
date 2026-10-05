import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";

import { readProviderFile } from "./provider-file";
import { ProviderStore } from "./provider-store";

test("unsupported provider formats reject without rewriting storage", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".provider-file-test-"));
  const file = join(root, "provider.json");
  try {
    for (const version of [1, 3, undefined]) {
      const contents = JSON.stringify({ version, providers: [] });
      await writeFile(file, contents);
      await expect(readProviderFile(file)).rejects.toThrow("provider_config_invalid");
      await expect(
        new ProviderStore(file).upsert({
          id: "gateway",
          kind: "custom",
          name: "Gateway",
          baseUrl: "https://example.com/v1",
          api: "openai-completions",
          authentication: "none",
          models: [{ id: "example" }],
        }),
      ).rejects.toThrow("provider_config_invalid");
      expect(await readFile(file, "utf8")).toBe(contents);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
