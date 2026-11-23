import { join } from "node:path";
import { access } from "node:fs/promises";

import { EchoStore } from "./store";
import { createEchoBridge } from "./bridge";
import { ProjectStore } from "../projects/project-store";
import { SessionRegistry } from "../session-registry";
import type { ProviderSettings } from "../providers/provider-settings";
import { echoRoutes } from "./routes";
import { sessionRoutes } from "../routes/sessions";
import { sessionImageRoutes } from "../routes/session-images";
import { HttpError } from "../http/errors";
import { echoProvider } from "./bridge";

export const createEchoService = (agentDir: string, providers: ProviderSettings) => {
  const store = new EchoStore(join(agentDir, "echo"));
  const registry = new SessionRegistry(
    new ProjectStore(join(store.directory, "projects.json")),
    createEchoBridge(store, agentDir, providers),
  );
  const routes = echoRoutes(store, registry);
  const ordinary = [sessionImageRoutes(registry), sessionRoutes(registry)];
  return {
    store,
    registry,
    async route(request: Request, url: URL): Promise<Response | undefined> {
      if (url.pathname.startsWith("/api/echo")) return routes(request, url);
      const match = url.pathname.match(/^\/api\/sessions\/([^/]+)/);
      if (!match || !/^[a-f0-9-]{36}$/.test(match[1]!)) return;
      try {
        await access(join(store.directory, "conversations", match[1]!, "meta.json"));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
        throw error;
      }
      if (!(await store.read()).conversations.some((chat) => chat.id === match[1])) return;
      if (url.pathname.endsWith("/files")) {
        const chat = (await store.read()).conversations.find((chat) => chat.id === match[1])!;
        if (!chat.computerId) throw new HttpError(409, "echo_computer_required");
        if (request.method !== "GET") throw new HttpError(405, "method_not_allowed");
        const path = url.searchParams.get("path") ?? "";
        const remotePath = path.startsWith("/workspace/") ? path.slice(11) : path;
        const result = await (await echoProvider(store)).download(
          chat.computerId,
          chat.id,
          remotePath,
          request.signal,
        );
        return new Response(result.body, {
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": "attachment",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      if (url.pathname.endsWith("/reveal"))
        throw new HttpError(400, "echo_local_reveal_unavailable");
      if (url.pathname.endsWith("/mode") || url.pathname.endsWith("/execute-plan"))
        throw new HttpError(400, "echo_plan_unavailable");
      for (const route of ordinary) {
        const response = await route(request, url);
        if (response) return response;
      }
    },
    close: () => registry.close(),
  };
};
