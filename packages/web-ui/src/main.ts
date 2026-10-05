import { parseArguments } from "./backend/startup/arguments";
import { openBrowser } from "./backend/startup/open-browser";

import type { ServerOptions } from "./backend/server";

export const main = async (
  args = process.argv.slice(2),
  serverOptions: ServerOptions = {},
): Promise<void> => {
  const options = parseArguments(args);

  if (options.help) {
    console.log("Loop Web: --port <0-65535> --no-open --help");

    return;
  }

  const { startServer } = await import("./backend/server");
  const server = await startServer(options.port, serverOptions);

  try {
    const ready = await fetch(server.url);

    if (!ready.ok)
      throw new Error("Frontend could not be built; check Web dependency requirements");

    await ready.arrayBuffer();
  } catch (error) {
    await server.close();
    throw error;
  }

  console.log("Loop Web: " + server.url);

  if (options.open && !process.env.SSH_CONNECTION && !process.env.SSH_TTY) {
    void openBrowser(server.url).catch(() =>
      console.error("Open the printed URL in your browser."),
    );
  }

  let closing = false;
  const close = () => {
    if (closing) return;

    closing = true;
    void server
      .close()
      .catch((error) => {
        console.error(error);
        process.exitCode = 1;
      })
      .finally(() => {
        process.off("SIGINT", close);
        process.off("SIGTERM", close);
      });
  };

  process.on("SIGINT", close);
  process.on("SIGTERM", close);
};

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file://").href) {
  await main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
