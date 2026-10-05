#!/usr/bin/env node
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

try {
  loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

try {
  const [command, ...args] = process.argv.slice(2);
  if (command === "web") {
    const { main } = await import("@loop/web-ui");
    const development = args.includes("--dev");
    await main(
      args.filter((arg) => arg !== "--dev"),
      {
        development,
        assetsDir: fileURLToPath(new URL("./web/", import.meta.url)),
      },
    );
  } else {
    const { main } = await import("@loop/coding-agent/cli");
    process.exitCode = await main(process.argv.slice(2));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
