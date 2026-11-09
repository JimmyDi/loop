import { fileURLToPath } from "node:url";
import { getAgentDir } from "@loop/coding-agent";

import { createHttpServer, listen } from "../http/node-server";
import { restartingResponse } from "../http/restarting-response";
import { createDevelopmentFrontend, developmentResponse } from "../http/development-frontend";
import { startDevelopmentBackend } from "./development-backend";
import { attachVoiceUpgrade } from "../http/voice-upgrade";
import { createAccountServer } from "../auth/account-server";

export const startDevelopmentGateway = async (port: number) => {
  const assets = fileURLToPath(new URL("../../../dist/web/", import.meta.url));
  const backend = startDevelopmentBackend();
  const application = await createAccountServer(getAgentDir(), assets, backend).catch(
    async (error) => {
      await backend.close();
      throw error;
    },
  );
  const server = createHttpServer((request) => {
    const path = new URL(request.url).pathname;
    if (["/", "/index.html"].includes(path) && !backend.ready()) return restartingResponse(request);
    return path.startsWith("/api/")
      ? application.handle(request)
      : developmentResponse(request, assets);
  });
  const closeVoice = attachVoiceUpgrade(
    server,
    application.authorizeVoice,
    application.connectVoice,
    application.trackVoice,
    { allowVite: true },
  );
  let frontend: Awaited<ReturnType<typeof createDevelopmentFrontend>> | undefined;
  const close = async () => {
    closeVoice();
    try {
      await application.close();
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
