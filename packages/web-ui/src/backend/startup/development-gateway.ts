import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getAgentDir } from "@loop/coding-agent";

import { createHttpServer, listen } from "../http/node-server";
import { assertLocalRequest } from "../http/local-request";
import { errorResponse } from "../http/errors";
import { restartingResponse } from "../http/restarting-response";
import { createDevelopmentFrontend, developmentResponse } from "../http/development-frontend";
import { createRemoteAccess } from "../remote-access/create-remote-access";
import { RemoteDevices } from "../remote-access/remote-devices";
import { DeviceStore } from "../remote-access/device-store";
import { startRemoteIngress } from "../remote-access/remote-ingress";
import { remoteAccessRoutes } from "../routes/remote-access";
import { startDevelopmentBackend } from "./development-backend";

export const startDevelopmentGateway = async (port: number) => {
  const agentDir = getAgentDir();
  const assets = fileURLToPath(new URL("../../../dist/web/", import.meta.url));
  const devices = new RemoteDevices(
    new DeviceStore(join(agentDir, "web-ui", "remote-access", "devices.json")),
  );
  await devices.load();
  const backend = startDevelopmentBackend();
  const remote = await createRemoteAccess(agentDir, (port) =>
    startRemoteIngress(devices, backend.handle, assets, port, backend.ready),
  ).catch(async (error) => {
    await backend.close();
    throw error;
  });
  const controls = remoteAccessRoutes(remote, devices);
  const server = createHttpServer(async (request) => {
    try {
      assertLocalRequest(request);
      const url = new URL(request.url);
      if (url.pathname === "/api/remote-session" && request.method === "GET")
        return Response.json({ mode: "local" }, { headers: { "Cache-Control": "no-store" } });
      const control = await controls(request, url);
      if (control) return control;
      if (["/", "/index.html"].includes(url.pathname) && !backend.ready())
        return restartingResponse(request);
      return url.pathname.startsWith("/api/")
        ? backend.handle(request)
        : developmentResponse(request, assets);
    } catch (error) {
      return errorResponse(error);
    }
  });
  let frontend: Awaited<ReturnType<typeof createDevelopmentFrontend>> | undefined;
  const close = async () => {
    try {
      await remote.close();
    } finally {
      await backend.close();
      await frontend?.close();
      if (server.listening)
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
          server.closeAllConnections();
        });
    }
  };
  try {
    frontend = await createDevelopmentFrontend(server);
    const url = await listen(server, port);
    return { url: url.href, close };
  } catch (error) {
    await close();
    throw error;
  }
};
