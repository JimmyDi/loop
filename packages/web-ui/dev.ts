import { loadEnvFile } from "node:process";

import { main } from "./src/main";
import { startDevelopmentGateway } from "./src/backend/startup/development-gateway";
import { watchFrontend } from "./watch-frontend";

try {
  loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

await main(process.argv.slice(2), { development: true }, async (port) => {
  const frontend = watchFrontend();
  try {
    const gateway = await startDevelopmentGateway(port);
    return {
      url: gateway.url,
      close: async () => {
        try {
          await frontend.close();
        } finally {
          await gateway.close();
        }
      },
    };
  } catch (error) {
    await frontend.close();
    throw error;
  }
});
