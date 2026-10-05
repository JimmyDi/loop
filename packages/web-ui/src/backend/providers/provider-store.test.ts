import { join } from "node:path";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { expect, test } from "vitest";

import { ProviderStore } from "./provider-store";

test("provider storage persists privately, redacts keys and never reuses keys on a new URL", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".provider-test-"));
  const file = join(root, "web", "provider.json");
  const input = {
    name: "Gateway",
    baseUrl: "http://localhost:8080/v1",
    id: "gateway",
    kind: "custom" as const,
    api: "openai-completions",
    models: [{ id: "gpt-5.5" }],
    authentication: "apiKey" as const,
  };

  try {
    const store = new ProviderStore(file);

    expect(await store.list()).toEqual([]);
    await store.upsert({ ...input, apiKey: "test-secret" });
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect(JSON.stringify(await store.list())).not.toContain("test-secret");
    expect((await store.list())[0]).toMatchObject({ hasApiKey: true, id: "gateway" });
    await store.upsert({ ...input, name: "Renamed" });
    expect((await new ProviderStore(file).all())[0]?.apiKey).toBe("test-secret");
    await expect(store.upsert({ ...input, baseUrl: "https://other.example/v1" })).rejects.toThrow(
      "provider_key_required",
    );
    expect((await store.all())[0]?.baseUrl).toBe(input.baseUrl);
    await store.upsert({ ...input, authentication: "none" });
    expect((await store.list())[0]?.hasApiKey).toBe(false);
    expect(await readFile(file, "utf8")).not.toContain("test-secret");
    await writeFile(file, "invalid json with secret");
    await expect(store.all()).rejects.toThrow("provider_config_invalid");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("multiple providers retain isolated secrets and deletions persist", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".provider-test-"));
  const file = join(root, "provider.json");
  try {
    const store = new ProviderStore(file);
    await store.upsert(
      {
        id: "gateway",
        kind: "custom",
        api: "openai-completions",
        name: "First",
        baseUrl: "https://example.com/v1",
        models: [{ id: "first-model" }],
        authentication: "apiKey",
        apiKey: "first-test-key",
      },
      true,
    );
    const config = {
      id: "openai",
      kind: "custom" as const,
      name: "Second",
      baseUrl: "https://example.com/v1",
      api: "openai-responses",
      authentication: "apiKey" as const,
      apiKey: "second-test-key",
      models: [{ id: "same-id" }, { id: "other" }],
    };
    await store.upsert(config, true);
    expect((await readFile(file, "utf8").then(JSON.parse)).version).toBe(2);
    expect((await store.all()).map((entry) => entry.apiKey)).toEqual([
      "first-test-key",
      "second-test-key",
    ]);
    await expect(store.upsert(config, true)).rejects.toThrow("provider_exists");
    await store.upsert({ ...config, apiKey: undefined, name: "Renamed" });
    await expect(
      store.upsert({ ...config, apiKey: undefined, api: "anthropic-messages" }),
    ).rejects.toThrow("provider_key_required");
    expect((await store.all())[1]?.api).toBe("openai-responses");
    await store.remove("gateway");
    expect((await new ProviderStore(file).list()).map((entry) => entry.id)).toEqual(["openai"]);
    const saved = (await new ProviderStore(file).all())[0]!;
    expect(saved.kind).toBe("custom");
    expect(saved.models.map((model) => model.id)).toEqual(["same-id", "other"]);
    await expect(store.upsert({ ...config, kind: "builtin" }, true)).rejects.toThrow(
      "provider_exists",
    );
    await expect(store.upsert({ ...config, kind: "builtin" })).rejects.toThrow("invalid_provider");
    await store.remove("openai");
    expect(await new ProviderStore(file).all()).toEqual([]);
    expect(await readFile(file, "utf8")).not.toContain("test-key");
    await expect(store.remove("missing")).rejects.toThrow("provider_not_found");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
