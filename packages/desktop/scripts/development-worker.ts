import { startServer } from "@loop/web-ui";
import type { ServerMaintenance } from "@loop/web-ui";
import { resolve } from "node:path";

let maintenance: ServerMaintenance;
let closing = false;
const backend = await startServer(0, {
  assetsDir: resolve(import.meta.dirname, "../dist/web"),
  authorize: (request) => request.headers.get("x-loop-desktop") === process.env.LOOP_DESKTOP_TOKEN,
  onMaintenance: (value) => {
    maintenance = value;
  },
});
process.send?.({ event: "ready", url: backend.url });
process.on("message", async (command: { id: number; action: string; stop?: boolean }) => {
  try {
    let value: unknown;
    if (command.action === "status") value = maintenance.status();
    else if (command.action === "prepare") value = await maintenance.prepare(command.stop === true);
    else if (command.action === "resume") maintenance.resume();
    else if (command.action === "shutdown") {
      closing = true;
      await backend.close();
    } else throw new Error("Unknown development command");
    process.send?.({ id: command.id, ok: true, value });
    if (command.action === "shutdown") process.disconnect();
  } catch (error) {
    process.send?.({ id: command.id, ok: false, error: String(error) });
  }
});
process.on("disconnect", () => {
  if (closing) process.exit();
  void backend.close().finally(() => process.exit());
});
