import { expect, test } from "bun:test";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { join } from "node:path";

import { ProviderStore } from "./provider-store";

test("provider storage persists privately, redacts keys and never reuses keys on a new URL", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".provider-test-"));
  const file = join(root, "web", "provider.json");
  const input = {
    name: "Gateway",
    baseUrl: "http://localhost:8080/v1",
    modelId: "gpt-5.5",
    authentication: "apiKey" as const,
  };

  try {
    const store = new ProviderStore(file);

    expect(await store.view()).toBeNull();
    await store.save({ ...input, apiKey: "test-secret" });
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect(JSON.stringify(await store.view())).not.toContain("test-secret");
    expect(await store.view()).toMatchObject({ hasApiKey: true, provider: "loop-custom" });
    await store.save({ ...input, name: "Renamed" });
    expect((await new ProviderStore(file).read())?.apiKey).toBe("test-secret");
    await expect(store.save({ ...input, baseUrl: "https://other.example/v1" })).rejects.toThrow(
      "provider_key_required",
    );
    expect((await store.read())?.baseUrl).toBe(input.baseUrl);
    await store.save({ ...input, authentication: "none" });
    expect((await store.view())?.hasApiKey).toBe(false);
    expect(await Bun.file(file).text()).not.toContain("test-secret");
    await Bun.write(file, "invalid json with secret");
    await expect(store.read()).rejects.toThrow("provider_config_invalid");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("version one migrates on mutation, multiple providers retain isolated secrets and deletions persist", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".provider-test-"));
  const file = join(root, "provider.json");
  try {
    await Bun.write(
      file,
      JSON.stringify({
        version: 1,
        name: "Legacy",
        baseUrl: "https://example.com/v1",
        modelId: "old-model",
        authentication: "apiKey",
        apiKey: "legacy-test-key",
      }),
    );
    const store = new ProviderStore(file);
    expect((await store.list())[0]).toMatchObject({
      id: "loop-custom",
      models: [{ id: "old-model" }],
      hasApiKey: true,
    });
    expect((await Bun.file(file).json()).version).toBe(1);
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
    expect((await Bun.file(file).json()).version).toBe(2);
    expect((await store.all()).map((entry) => entry.apiKey)).toEqual([
      "legacy-test-key",
      "second-test-key",
    ]);
    await expect(store.upsert(config, true)).rejects.toThrow("provider_exists");
    await store.upsert({ ...config, apiKey: undefined, name: "Renamed" });
    await expect(
      store.upsert({ ...config, apiKey: undefined, api: "anthropic-messages" }),
    ).rejects.toThrow("provider_key_required");
    expect((await store.all())[1]?.api).toBe("openai-responses");
    await store.remove("loop-custom");
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
    expect(await new ProviderStore(file).configured()).toBe(true);
    expect(await Bun.file(file).text()).not.toContain("test-key");
    await expect(store.remove("missing")).rejects.toThrow("provider_not_found");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
