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
