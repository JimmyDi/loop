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
  const icon = (name: string, type: string) => () =>
    new Response(Bun.file(join(import.meta.dir, "../frontend/assets", name)), {
      headers: { "Content-Type": type, "Cache-Control": "no-cache" },
    });
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port,
    idleTimeout: 0,
    // Prompt bodies have no application size cap; other routes bound their JSON reads.
    maxRequestBodySize: Infinity,
    routes: {
      "/": page,
      "/api/*": route,
      "/favicon.ico": icon("loop-icon.ico", "image/x-icon"),
      "/assets/loop-mask-icon.svg": icon("loop-mask-icon.svg", "image/svg+xml"),
      "/apple-touch-icon.png": icon("loop-apple-touch-icon.png", "image/png"),
    },
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
