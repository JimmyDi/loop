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
import { createDevelopmentFrontend, developmentResponse } from "./http/development-frontend";
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
  const remoteAccess = await createRemoteAccess(agentDir, (port) =>
    startRemoteIngress(devices, business, assetsDir, port),
  );
  const route = createRouter(registry, providers, settings, mcp, skills, remoteAccess, devices);
  const server = createHttpServer((request) =>
    new URL(request.url).pathname.startsWith("/api/")
      ? route(request)
      : options.development
        ? developmentResponse(request, assetsDir)
        : staticResponse(request, assetsDir),
  );
  let frontend: Awaited<ReturnType<typeof createDevelopmentFrontend>> | undefined;
  try {
    if (options.development) {
      frontend = await createDevelopmentFrontend(server);
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
          await frontend?.close();
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
    await frontend?.close();
    await registry.close();
    server.closeAllConnections();
    server.close();
    throw error;
  }
};
