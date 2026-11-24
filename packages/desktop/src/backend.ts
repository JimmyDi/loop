import { createInterface } from "node:readline";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "@loop/web-ui";
import type { ServerMaintenance } from "@loop/web-ui";

import { createGateway } from "./gateway";
import type { UpdateState } from "./gateway";

const send = (message: unknown) => process.stdout.write(JSON.stringify(message) + "\n");
const data = process.env.LOOP_DESKTOP_STATE_DIR;
const token = process.env.LOOP_DESKTOP_TOKEN;
if (!data || !token) throw new Error("Desktop launch configuration is missing");
if (Number(process.versions.node.split(".")[0]) < 24) throw new Error("Node 24 is required");
await mkdir(data, { recursive: true });
const assets = fileURLToPath(new URL("./web/", import.meta.url));
let maintenance: ServerMaintenance | undefined;
let state: UpdateState = { phase: "idle" };
const backend = await startServer(0, {
  authorize: (request) => request.headers.get("x-loop-desktop") === token,
  assetsDir: assets,
  onMaintenance: (value) => {
    maintenance = value;
  },
});
let port = 0;
try {
  port = Number(await readFile(join(data, "desktop-port"), "utf8"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
const gateway = await createGateway({
  backend: backend.url,
  token,
  port,
  assets,
  state: () => state,
  action: (action) => send({ event: action }),
});
port = (gateway.address() as { port: number }).port;
await writeFile(join(data, "desktop-port"), String(port), { mode: 0o600 });
send({ event: "ready", url: "http://127.0.0.1:" + port });

let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  await backend.close();
  gateway.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    gateway.close((error) => (error ? reject(error) : resolve())),
  );
};
const lines = createInterface({ input: process.stdin });
for await (const line of lines) {
  let id: unknown;
  try {
    const command = JSON.parse(line);
    id = command.id;
    let value: unknown;
    if (command.action === "status") value = maintenance!.status();
    else if (command.action === "prepare")
      value = await maintenance!.prepare(command.stop === true);
    else if (command.action === "resume") maintenance!.resume();
    else if (command.action === "state") state = command.state;
    else if (command.action === "shutdown") await close();
    else throw new Error("Unknown desktop command");
    send({ id, ok: true, value });
    if (closing) break;
  } catch (error) {
    send({
      id,
      ok: false,
      error: error instanceof Error ? error.message : "Desktop operation failed",
    });
  }
}
await close();
process.exit(0);
