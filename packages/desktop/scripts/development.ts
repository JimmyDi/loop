import { createServer } from "vite";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";

import { createGateway } from "../src/gateway";
import { startBackend } from "./development-backend";

const data = process.env.LOOP_DESKTOP_STATE_DIR;
const token = process.env.LOOP_DESKTOP_TOKEN;
if (!data || !token) throw new Error("Desktop development launch configuration is missing");
const send = (value: unknown) => process.stdout.write(JSON.stringify(value) + "\n");
const desktop = resolve(import.meta.dirname, "..");
const vite = await createServer({
  configFile: resolve(desktop, "../web-ui/vite.config.ts"),
  configLoader: "runner",
  logLevel: "warn",
  server: { host: "127.0.0.1", port: 0 },
  plugins: [
    {
      name: "desktop-development",
      transform(code, id) {
        if (id.endsWith("/frontend/main.tsx")) return code.replace("startPwa();", "");
      },
      transformIndexHtml(html) {
        return html
          .replace(/<link[^>]+rel="manifest"[^>]*>/g, "")
          .replace(
            "</body>",
            '<script type="module" src="/@fs/' +
              join(desktop, "src/client.ts").replaceAll("\\", "/") +
              '"></script></body>',
          );
      },
    },
  ],
});
await vite.listen();
const backend = await startBackend(() => vite.ws.send({ type: "full-reload" }));
await mkdir(data, { recursive: true });
let port = 0;
try {
  port = Number(await readFile(join(data, "desktop-port"), "utf8"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
const gateway = await createGateway({
  backend: backend.url,
  frontend: vite.resolvedUrls!.local[0]!,
  port,
  token,
  assets: join(desktop, "dist/web"),
  state: () => ({ phase: "disabled" }),
  action: () => {},
});
port = (gateway.address() as { port: number }).port;
await writeFile(join(data, "desktop-port"), String(port));
send({ event: "ready", url: "http://127.0.0.1:" + port });
const lines = createInterface({ input: process.stdin });
let shutdownId: unknown;
try {
  for await (const line of lines) {
    let id: unknown;
    try {
      const command = JSON.parse(line);
      id = command.id;
      if (command.action === "shutdown") {
        shutdownId = id;
        break;
      }
      const value =
        command.action === "state"
          ? undefined
          : await backend.request(command.action, command.stop);
      send({ id, ok: true, value });
    } catch (error) {
      send({ id, ok: false, error: String(error) });
    }
  }
} finally {
  await backend.close();
  await vite.close();
  gateway.closeAllConnections();
  await new Promise<void>((resolve) => gateway.close(() => resolve()));
}
if (shutdownId !== undefined) send({ id: shutdownId, ok: true });
// Closing stdin also terminates development watchers when the native shell exits.
process.exit(0);
