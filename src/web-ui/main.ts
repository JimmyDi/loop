import { parseArguments } from "./backend/startup/arguments";
import { openBrowser } from "./backend/startup/open-browser";

export const main = async (args = process.argv.slice(2)): Promise<void> => {
  const options = parseArguments(args);

  if (options.help) {
    console.log("Loop Web: --port <0-65535> --no-open --help");

    return;
  }

  const { startServer } = await import("./backend/server");
  const server = startServer(options.port);

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

if (import.meta.main) {
  await main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
