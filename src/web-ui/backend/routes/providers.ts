import { readBody } from "../http/input";
import { HttpError } from "../http/errors";
import type { ProviderSettings } from "../providers/provider-settings";
import { validateProvider } from "../providers/validate-provider";
import { validateProviderConfig } from "../providers/validate-provider-config";
import { discoverModels } from "../providers/discover-models";
import type { SessionRegistry } from "../session-registry";

export const providerRoutes =
  (registry: SessionRegistry, providers: ProviderSettings) =>
  async (request: Request, url: URL): Promise<Response | undefined> => {
    if (url.pathname === "/api/settings/providers/discover" && request.method === "POST") {
      return Response.json(await discoverModels(await readBody(request), providers.store));
    }
    const segments = url.pathname.split("/");
    if (segments.slice(0, 4).join("/") === "/api/settings/providers" && segments.length <= 5) {
      const id = segments[4];
      if (request.method === "GET" && !id) return Response.json(await providers.view());
      if (request.method === "DELETE" && id) {
        await registry.configure(() => providers.remove(id));
      } else if ((request.method === "POST" && !id) || (request.method === "PUT" && id)) {
        const input = validateProviderConfig(await readBody(request));
        if (id && input.id !== id) throw new HttpError(400, "invalid_provider_id");
        await registry.configure(() => providers.upsert(input, !id));
      } else throw new HttpError(405, "method_not_allowed");
      return Response.json(await providers.view());
    }
    if (url.pathname !== "/api/settings/provider") return;

    if (request.method === "PUT") {
      const input = validateProvider(await readBody(request));

      await registry.configure(() => providers.save(input));
    } else if (request.method !== "GET") throw new HttpError(405, "method_not_allowed");

    return Response.json(await providers.store.view());
  };
