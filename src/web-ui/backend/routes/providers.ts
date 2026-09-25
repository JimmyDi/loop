import { readBody } from "../http/input";
import { HttpError } from "../http/errors";
import type { ProviderSettings } from "../providers/provider-settings";
import { validateProvider } from "../providers/validate-provider";
import type { SessionRegistry } from "../session-registry";

export const providerRoutes =
  (registry: SessionRegistry, providers: ProviderSettings) =>
  async (request: Request, url: URL): Promise<Response | undefined> => {
    if (url.pathname !== "/api/settings/provider") return;

    if (request.method === "PUT") {
      const input = validateProvider(await readBody(request));

      await registry.configure(() => providers.save(input));
    } else if (request.method !== "GET") throw new HttpError(405, "method_not_allowed");

    return Response.json(await providers.store.view());
  };
