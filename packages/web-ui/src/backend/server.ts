import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getAgentDir, McpManager, SkillManager } from "@loop/coding-agent";

import { createLoopBridge } from "./loop";
import { ProjectStore } from "./projects/project-store";
import { createRouter } from "./router";
import { SessionRegistry } from "./session-registry";
import { ProviderSettings } from "./providers/provider-settings";
import { WebSettings } from "./settings/web-settings";
import { createHttpServer, listen } from "./http/node-server";
import { staticResponse } from "./http/static-files";
import { createRemoteAccess } from "./remote-access/create-remote-access";
import { createBusinessRouter } from "./business-router";
import { DeviceStore } from "./remote-access/device-store";
import { RemoteDevices } from "./remote-access/remote-devices";
import { startRemoteIngress } from "./remote-access/remote-ingress";

export type ServerOptions = { development?: boolean; assetsDir?: string };

export const startServer = async (port = 3080, options: ServerOptions = {}) => {
  const agentDir = getAgentDir();
  const devices = new RemoteDevices(
    new DeviceStore(join(agentDir, "web-ui", "remote-access", "devices.json")),
  );
  await devices.load();
  const projects = new ProjectStore(join(agentDir, "web-ui", "projects.json"));
  const providers = new ProviderSettings(join(agentDir, "web-ui", "provider.json"));
  const settings = new WebSettings(agentDir);
  const mcp = new McpManager(join(agentDir, "mcp.json"));
  const skills = new SkillManager(agentDir);
  skills.view(agentDir);
  const registry = new SessionRegistry(
    projects,
    createLoopBridge(agentDir, providers, settings, mcp, skills),
  );
  const assetsDir =
    options.assetsDir ??
    fileURLToPath(new URL(options.development ? "../../dist/web/" : "./web/", import.meta.url));
  const business = createBusinessRouter(registry, providers, settings, mcp, skills);
  const remoteAccess = await createRemoteAccess(agentDir, () =>
    startRemoteIngress(devices, business, assetsDir),
  );
  const route = createRouter(registry, providers, settings, mcp, skills, remoteAccess, devices);
  const server = createHttpServer((request) =>
    new URL(request.url).pathname.startsWith("/api/")
      ? route(request)
      : staticResponse(request, assetsDir),
  );
  let vite: import("vite").ViteDevServer | undefined;
  try {
    if (options.development) {
      const { createServer } = await import("vite");
      vite = await createServer({
        configLoader: "runner",
        configFile: fileURLToPath(new URL("../../vite.config.ts", import.meta.url)),
        server: { middlewareMode: true, hmr: { server } },
        appType: "spa",
      });
      const handler = server.listeners("request")[0]!;
      server.removeAllListeners("request");
      server.on("request", (request, response) => {
        if (request.url?.startsWith("/api/")) handler.call(server, request, response);
        else vite!.middlewares(request, response, () => handler.call(server, request, response));
      });
    }
    const url = await listen(server, port);
    return {
      url: url.href,
      async close() {
        try {
          await remoteAccess.close();
          await registry.close();
        } finally {
          await mcp.close();
          await skills.close();
          await vite?.close();
          await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
            server.closeAllConnections();
          });
        }
      },
    };
  } catch (error) {
    await remoteAccess.close();
    await mcp.close();
    await skills.close();
    await vite?.close();
    await registry.close();
    server.closeAllConnections();
    server.close();
    throw error;
  }
};
