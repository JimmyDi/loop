import { getRequestListener } from "@hono/node-server";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { expect, test } from "vitest";

import { getProviderCatalog } from "@loop/coding-agent";
import { ProviderStore } from "./provider-store";
import { discoverModels } from "./discover-models";
import { validateProviderConfig } from "./validate-provider-config";

test("discovery isolates saved keys by endpoint and protocol, handles catalogs and redacts failures", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".discovery-test-"));
  const requests: { path: string; key: string | null; version: string | null }[] = [];
  const server = await serveTest({
    port: 0,
    hostname: "127.0.0.1",
    fetch(request) {
      const path = new URL(request.url).pathname;
      requests.push({
        path,
        key: request.headers.get("authorization") ?? request.headers.get("x-api-key"),
        version: request.headers.get("anthropic-version"),
      });
      if (path.startsWith("/redirect"))
        return Response.redirect(new URL("/v1/models", request.url));
      if (path.startsWith("/error")) return new Response("upstream-secret", { status: 401 });
      if (path.startsWith("/large")) return new Response("x".repeat(2_097_153));
      if (path.startsWith("/map"))
        return Response.json({
          models: {
            mapped: {
              name: "Mapped",
              context_window: 8192,
              max_output_tokens: 4096,
            },
          },
        });
      if (path.startsWith("/capacity"))
        return Response.json({
          data: [
            { id: "camel", contextWindow: 16384, maxTokens: 8192 },
            { id: "invalid", context_window: -1, max_tokens: 200000 },
            { id: "oversized", contextWindow: 1024, maxTokens: 2048 },
          ],
        });
      return Response.json({
        data: [{ id: "one", display_name: "One" }, { id: "one" }, { id: "two" }, { invalid: true }],
      });
    },
  });
  try {
    const store = new ProviderStore(join(root, "provider.json"));
    const config = {
      id: "gateway",
      kind: "custom" as const,
      name: "Gateway",
      api: "openai-completions",
      baseUrl: new URL("/v1", server.url).href,
      authentication: "apiKey" as const,
      apiKey: "saved-test-key",
      models: [{ id: "one" }],
    };
    await store.upsert(config);
    const draft = { ...config, apiKey: undefined, savedId: "gateway" };
    expect((await discoverModels(draft, store)).map((item) => item.id)).toEqual(["one", "two"]);
    expect(requests[0]).toMatchObject({ path: "/v1/models", key: "Bearer saved-test-key" });
    await expect(discoverModels({ ...draft, api: "anthropic-messages" }, store)).rejects.toThrow(
      "provider_key_required",
    );
    await expect(
      discoverModels({ ...draft, baseUrl: new URL("/other", server.url).href }, store),
    ).rejects.toThrow("provider_key_required");
    expect(requests).toHaveLength(1);
    await discoverModels({ ...draft, api: "anthropic-messages", apiKey: "new-test-key" }, store);
    expect(requests[1]).toEqual({ path: "/v1/models", key: "new-test-key", version: "2023-06-01" });
    expect(
      await discoverModels(
        { ...draft, authentication: "none", baseUrl: new URL("/map", server.url).href },
        store,
      ),
    ).toEqual([{ id: "mapped", name: "Mapped", contextWindow: 8192, maxTokens: 4096 }]);
    expect(requests[2]?.key).toBeNull();
    for (const path of ["error", "redirect", "large"]) {
      await expect(
        discoverModels(
          { ...draft, apiKey: "temporary-key", baseUrl: new URL(path, server.url).href },
          store,
        ),
      ).rejects.toThrow("provider_discovery_failed");
    }
    expect(requests).toHaveLength(6);
    expect(
      await discoverModels(
        { ...draft, authentication: "none", baseUrl: new URL("/capacity", server.url).href },
        store,
      ),
    ).toEqual([
      { id: "camel", name: "camel", contextWindow: 16384, maxTokens: 8192 },
      { id: "invalid", name: "invalid" },
      { id: "oversized", name: "oversized", contextWindow: 1024 },
    ]);
    const beforeCatalog = requests.length;
    const catalog = await discoverModels({ ...draft, id: "openai", apiKey: undefined }, store);
    expect(catalog.length).toBeGreaterThan(1);
    expect(catalog.find((model) => model.id === "gpt-4")).toMatchObject({
      name: "GPT-4",
      contextWindow: 8192,
    });
    expect(requests).toHaveLength(beforeCatalog);
    for (const provider of getProviderCatalog()) {
      const models = await discoverModels({ id: provider.id }, store);
      expect(models).toHaveLength(provider.models.length);
      expect(validateProviderConfig({ ...config, id: provider.id, models }).models).toHaveLength(
        models.length,
      );
    }
    expect((await store.all())[0]?.apiKey).toBe("saved-test-key");
  } finally {
    await server.stop(true);
    await rm(root, { recursive: true, force: true });
  }
});

const serveTest = async (options: {
  hostname: string;
  port: number;
  fetch(request: Request): Response | Promise<Response>;
}) => {
  const server = createServer(getRequestListener(options.fetch));
  server.listen(options.port, options.hostname);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return {
    url: new URL("http://127.0.0.1:" + address.port + "/"),
    stop: async (_force?: boolean) =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
};
