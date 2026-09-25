import { join } from "node:path";

import { getAgentDir } from "../../coding-agent/index";
import page from "../frontend/index.html";
import { createLoopBridge } from "./loop";
import { ProjectStore } from "./projects/project-store";
import { createRouter } from "./router";
import { SessionRegistry } from "./session-registry";
import { ProviderSettings } from "./providers/provider-settings";

export const startServer = (port = 3080) => {
  const agentDir = getAgentDir();
  const projects = new ProjectStore(join(agentDir, "web-ui", "projects.json"));
  const providers = new ProviderSettings(join(agentDir, "web-ui", "provider.json"));
  const registry = new SessionRegistry(projects, createLoopBridge(agentDir, providers));
  const route = createRouter(registry, providers);
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port,
    idleTimeout: 0,
    routes: { "/": page, "/api/*": route },
    fetch: () => new Response("Not found", { status: 404 }),
    development: process.env.NODE_ENV !== "production" ? { hmr: true, console: true } : false,
  });

  return {
    url: server.url.toString(),
    async close() {
      try {
        await registry.close();
      } finally {
        await server.stop(true);
      }
    },
  };
};
