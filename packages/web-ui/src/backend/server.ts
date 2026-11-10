import { fileURLToPath } from "node:url";
import { getAgentDir } from "@loop/coding-agent";

import { createHttpServer, listen } from "./http/node-server";
import { staticResponse } from "./http/static-files";
import { createDevelopmentFrontend, developmentResponse } from "./http/development-frontend";
import { attachVoiceUpgrade } from "./http/voice-upgrade";
import { createAccountServer } from "./auth/account-server";

export type ServerOptions = { development?: boolean; assetsDir?: string };

export const startServer = async (port = 3080, options: ServerOptions = {}) => {
  const assetsDir =
    options.assetsDir ??
    fileURLToPath(new URL(options.development ? "../../dist/web/" : "./web/", import.meta.url));
  const application = await createAccountServer(getAgentDir(), assetsDir);
  const server = createHttpServer((request) =>
    new URL(request.url).pathname.startsWith("/api/")
      ? application.handle(request)
      : options.development
        ? developmentResponse(request, assetsDir)
        : staticResponse(request, assetsDir),
  );
  const closeVoice = attachVoiceUpgrade(
    server,
    application.authorizeVoice,
    application.connectVoice,
    application.trackVoice,
    { allowVite: options.development },
  );
  let frontend: Awaited<ReturnType<typeof createDevelopmentFrontend>> | undefined;
  try {
    if (options.development) frontend = await createDevelopmentFrontend(server);
    const url = await listen(server, port);
    return {
      url: url.href,
      async close() {
        closeVoice();
        try {
          await application.close();
        } finally {
          await frontend?.close();
          await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
            server.closeAllConnections();
          });
        }
      },
    };
  } catch (error) {
    closeVoice();
    await application.close();
    await frontend?.close();
    server.closeAllConnections();
    server.close();
    throw error;
  }
};
